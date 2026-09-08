import { Container, Graphics } from 'pixi.js';
import { Rig2D, SpringVec2, clamp, drawChainSkin, drawTaperedTube, type Vec2 } from '../rig2d';
import type { CharacterInteractionCapabilities, CharacterInteractionController, ReachOptions } from './runtime';
import type { CharacterGesture, PerformanceState } from './performance';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
type Side = 'left' | 'right';
type HandPose = 'folded' | 'relaxed' | 'open' | 'emphasis' | 'point';

interface HandTarget {
  position: Vec2;
  rotation: number;
  pose: HandPose;
}

interface ManualReach {
  target: Vec2;
  options: ReachOptions;
  pose: HandPose;
}

// These are wrist/end-effector targets, not authored elbow coordinates. The
// elbow is always solved by Rig2D from fixed limb lengths.
const REST: Record<Side, HandTarget> = {
  left: { position: { x: 42, y: 70 }, rotation: -0.08, pose: 'folded' },
  right: { position: { x: -42, y: 72 }, rotation: 0.08, pose: 'folded' },
};

const SHOULDER: Record<Side, Vec2> = {
  left: { x: -58, y: 3 },
  right: { x: 58, y: 5 },
};

const cloneTarget = (target: HandTarget): HandTarget => ({
  position: { ...target.position },
  rotation: target.rotation,
  pose: target.pose,
});

const activeSideFor = (state: PerformanceState): Side => state.gestureVariant % 2 === 0 ? 'right' : 'left';
const lerpPoint = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Milo's production Rig2D consumer.
 *
 * The skeleton is intentionally invisible. Rig2D solves fixed-length anatomy;
 * PixiChainSkin then draws one continuous shoulder -> elbow -> wrist silhouette.
 * This avoids the puppet look created by rendering each bone as its own capsule.
 */
export class MiloRig2D implements CharacterInteractionController {
  readonly view = new Container();
  readonly capabilities: CharacterInteractionCapabilities = {
    effectors: ['leftHand', 'rightHand'],
    attachments: ['leftPalm', 'rightPalm'],
    locomotion: ['idle'],
    actions: ['crossArms', 'openArms', 'touchFace', 'explain', 'emphasize', 'reassure', 'celebrate', 'shrug', 'greet'],
  };

  private readonly rig = new Rig2D([
    { name: 'root' },
    { name: 'shoulderL', parent: 'root', anchor: 'origin', x: SHOULDER.left.x, y: SHOULDER.left.y },
    { name: 'upperArmL', parent: 'shoulderL', anchor: 'origin', length: 74, minRotation: -2.95, maxRotation: 2.95 },
    { name: 'forearmL', parent: 'upperArmL', anchor: 'end', length: 90, minRotation: -2.85, maxRotation: 2.85 },
    { name: 'handL', parent: 'forearmL', anchor: 'end' },
    { name: 'shoulderR', parent: 'root', anchor: 'origin', x: SHOULDER.right.x, y: SHOULDER.right.y },
    { name: 'upperArmR', parent: 'shoulderR', anchor: 'origin', length: 74, minRotation: -2.95, maxRotation: 2.95 },
    { name: 'forearmR', parent: 'upperArmR', anchor: 'end', length: 90, minRotation: -2.85, maxRotation: 2.85 },
    { name: 'handR', parent: 'forearmR', anchor: 'end' },
  ], [
    { name: 'leftPalm', bone: 'handL' },
    { name: 'rightPalm', bone: 'handR' },
  ]);

  private readonly leftGroup = new Container();
  private readonly rightGroup = new Container();
  private readonly leftSkin = new Graphics();
  private readonly leftSleeve = new Graphics();
  private readonly leftHand = new Graphics();
  private readonly rightSkin = new Graphics();
  private readonly rightSleeve = new Graphics();
  private readonly rightHand = new Graphics();
  private readonly targetSpring = {
    left: new SpringVec2(REST.left.position),
    right: new SpringVec2(REST.right.position),
  };
  private readonly manual = new Map<Side, ManualReach>();
  private handPose: Record<Side, HandPose> = { left: 'folded', right: 'folded' };
  private handRotation: Record<Side, number> = { left: REST.left.rotation, right: REST.right.rotation };
  private forcedAction: CharacterGesture | null = null;
  private forcedActionIntensity = 0;
  private locomotion = 'idle';
  private activeGesture: CharacterGesture = 'none';

  constructor() {
    this.view.sortableChildren = true;
    this.leftGroup.sortableChildren = true;
    this.rightGroup.sortableChildren = true;
    this.leftSkin.zIndex = 1;
    this.rightSkin.zIndex = 1;
    this.leftSleeve.zIndex = 2;
    this.rightSleeve.zIndex = 2;
    this.leftHand.zIndex = 3;
    this.rightHand.zIndex = 3;
    this.leftGroup.addChild(this.leftSkin, this.leftSleeve, this.leftHand);
    this.rightGroup.addChild(this.rightSkin, this.rightSleeve, this.rightHand);
    this.leftGroup.zIndex = 1;
    this.rightGroup.zIndex = 2;
    this.view.addChild(this.leftGroup, this.rightGroup);
    this.updateSkeleton({} as PerformanceState, 0);
    this.render();
  }

  reach(effector: string, target: Vec2, options: ReachOptions = {}) {
    const side = this.sideForEffector(effector);
    this.manual.set(side, { target: { ...target }, options: { ...options }, pose: 'open' });
  }

  clearReach(effector?: string) {
    if (!effector) {
      this.manual.clear();
      return;
    }
    this.manual.delete(this.sideForEffector(effector));
  }

  pointAt(target: Vec2, effector = 'rightHand') {
    const side = this.sideForEffector(effector);
    this.manual.set(side, { target: { ...target }, options: { hold: true, weight: 1 }, pose: 'point' });
  }

  attach(effector: string, target: Vec2) {
    const side = this.sideForEffector(effector);
    this.manual.set(side, { target: { ...target }, options: { hold: true, weight: 1 }, pose: 'open' });
  }

  detach(effector?: string) {
    this.clearReach(effector);
  }

  action(name: string, intensity = 0.75) {
    const map: Record<string, CharacterGesture> = {
      crossArms: 'none',
      openArms: 'reassure',
      touchFace: 'think',
      explain: 'explain',
      emphasize: 'emphasize',
      reassure: 'reassure',
      celebrate: 'celebrate',
      shrug: 'shrug',
      greet: 'greet',
    };
    this.forcedAction = map[name] ?? null;
    this.forcedActionIntensity = clamp(intensity, 0, 1);
    if (name === 'crossArms') this.manual.clear();
  }

  setLocomotion(name: string) {
    this.locomotion = this.capabilities.locomotion.includes(name) ? name : 'idle';
  }

  update(state: PerformanceState, dt: number) {
    this.updateSkeleton(state, dt);
    this.render();
  }

  debugSnapshot() {
    return this.rig.debugSnapshot();
  }

  private updateSkeleton(state: PerformanceState, dt: number) {
    this.rig.resetToRest();

    const safeState = state?.gesture ? state : ({
      gesture: 'none', gestureVariant: 0, gestureEnvelope: 0, gesturePhase: 0,
      intensity: 0, mode: 'idle', speechBeat: 0,
    } as PerformanceState);
    const gesture = this.forcedAction ?? safeState.gesture;
    this.activeGesture = gesture;
    const intensity = this.forcedAction ? this.forcedActionIntensity : safeState.intensity;
    const envelope = this.forcedAction ? 1 : safeState.gestureEnvelope;
    const activeSide = activeSideFor(safeState);
    const targets = this.targetsForGesture(gesture, activeSide, envelope, intensity, safeState.gesturePhase);

    // Whichever hand is doing the communicative work should read in front when
    // silhouettes overlap. The crossed rest pose keeps the right forearm on top.
    if (gesture !== 'none') {
      this.leftGroup.zIndex = activeSide === 'left' ? 3 : 1;
      this.rightGroup.zIndex = activeSide === 'right' ? 3 : 1;
      this.view.sortChildren();
    } else {
      this.leftGroup.zIndex = 1;
      this.rightGroup.zIndex = 2;
      this.view.sortChildren();
    }

    for (const side of ['left', 'right'] as const) {
      const manual = this.manual.get(side);
      const desired = manual ? {
        position: manual.target,
        rotation: targets[side].rotation,
        pose: manual.pose,
      } : targets[side];
      const spring = this.targetSpring[side].update(desired.position, dt, manual ? 8.4 : 5.8, manual ? 0.9 : 0.86);
      this.handPose[side] = desired.pose;
      this.handRotation[side] = desired.rotation;

      const upper = side === 'left' ? 'upperArmL' : 'upperArmR';
      const lower = side === 'left' ? 'forearmL' : 'forearmR';
      const semanticBend = this.bendFor(side, gesture);
      this.rig.solveTwoBoneIK({
        upper,
        lower,
        target: spring,
        bend: manual?.options.bend ?? semanticBend,
        weight: manual?.options.weight ?? 1,
      });
    }

    if (this.forcedAction) {
      this.forcedActionIntensity *= Math.exp(-Math.max(0, dt) * 1.45);
      if (this.forcedActionIntensity < 0.08) this.forcedAction = null;
    }

    void this.locomotion;
  }

  private bendFor(side: Side, gesture: CharacterGesture): -1 | 1 {
    // Crossed/resting and reassuring poses open the elbows away from the torso;
    // presentation/celebration poses use the opposite branch so the forearm
    // travels outward instead of folding through the chest.
    const restFamily = gesture === 'none' || gesture === 'reassure';
    if (restFamily) return side === 'left' ? 1 : -1;
    return side === 'left' ? -1 : 1;
  }

  private targetsForGesture(
    gesture: CharacterGesture,
    activeSide: Side,
    envelope: number,
    intensity: number,
    phase: number,
  ): Record<Side, HandTarget> {
    const targets = { left: cloneTarget(REST.left), right: cloneTarget(REST.right) };
    const strength = clamp(envelope * (0.72 + intensity * 0.38), 0, 1);
    const blend = (side: Side, target: HandTarget, amount = strength) => {
      const from = targets[side];
      const t = clamp(amount, 0, 1);
      targets[side] = {
        position: {
          x: from.position.x + (target.position.x - from.position.x) * t,
          y: from.position.y + (target.position.y - from.position.y) * t,
        },
        rotation: from.rotation + (target.rotation - from.rotation) * t,
        pose: t > 0.18 ? target.pose : from.pose,
      };
    };

    const sign = activeSide === 'left' ? -1 : 1;
    switch (gesture) {
      case 'explain':
        blend(activeSide, { position: { x: sign * 132, y: 35 }, rotation: -sign * 0.12, pose: 'open' });
        break;
      case 'emphasize':
      case 'agree':
      case 'disagree':
        blend(activeSide, { position: { x: sign * 108, y: 46 }, rotation: -sign * 0.08, pose: 'emphasis' });
        break;
      case 'reassure':
        blend('left', { position: { x: -72, y: 76 }, rotation: 0.08, pose: 'open' });
        blend('right', { position: { x: 72, y: 76 }, rotation: -0.08, pose: 'open' });
        break;
      case 'think':
        blend('right', { position: { x: 42, y: -54 }, rotation: -0.36, pose: 'relaxed' });
        break;
      case 'celebrate':
        blend('left', { position: { x: -100, y: -104 }, rotation: 0.12, pose: 'open' });
        blend('right', { position: { x: 100, y: -104 }, rotation: -0.12, pose: 'open' });
        break;
      case 'shrug':
        blend('left', { position: { x: -132, y: 20 }, rotation: -0.04, pose: 'open' });
        blend('right', { position: { x: 132, y: 20 }, rotation: 0.04, pose: 'open' });
        break;
      case 'greet':
      case 'goodbye': {
        const wave = Math.sin(phase * Math.PI * 4.5) * 7;
        blend('right', { position: { x: 98 + wave, y: -88 }, rotation: -0.2 + wave * 0.006, pose: 'open' });
        break;
      }
      case 'none':
      default:
        break;
    }
    return targets;
  }

  private render() {
    this.renderSide('left');
    this.renderSide('right');
  }

  private renderSide(side: Side) {
    const upper = this.rig.getBone(side === 'left' ? 'upperArmL' : 'upperArmR');
    const lower = this.rig.getBone(side === 'left' ? 'forearmL' : 'forearmR');
    const skin = side === 'left' ? this.leftSkin : this.rightSkin;
    const sleeve = side === 'left' ? this.leftSleeve : this.rightSleeve;
    const hand = side === 'left' ? this.leftHand : this.rightHand;

    const shoulder = upper.start;
    const elbow = upper.end;
    const wrist = lower.end;

    drawChainSkin(skin, shoulder, elbow, wrist, {
      widths: [16.2, 14.5, 10.4],
      fill: C.paper,
      stroke: C.ink,
      strokeWidth: 3.2,
      miterLimit: 1.34,
    });

    // Clothing is an overlay on the continuous arm skin. Its cuff may be visible,
    // but the elbow joint itself is never exposed as a separate rendered part.
    const sleeveEnd = lerpPoint(shoulder, elbow, 0.7);
    drawTaperedTube(sleeve, shoulder, sleeveEnd, {
      startWidth: 15.2,
      endWidth: 13.4,
      fill: C.ink,
      stroke: C.paper,
      strokeWidth: 2.35,
    });

    const handRotation = lower.worldRotation + this.handRotation[side];
    this.drawHand(hand, wrist, handRotation, this.handPose[side], side === 'left' ? -1 : 1);
  }

  private drawHand(graphics: Graphics, position: Vec2, rotation: number, pose: HandPose, side: -1 | 1) {
    graphics.clear();
    graphics.position.set(position.x, position.y);
    graphics.rotation = rotation;

    if (pose === 'point') {
      // Compact palm + a single unmistakable index finger. This is authored as
      // a pose, not inferred finger physics.
      graphics
        .moveTo(-2, -7)
        .bezierCurveTo(5, -10, 13, -8, 16, -3)
        .bezierCurveTo(18, 1, 15, 7, 9, 8)
        .bezierCurveTo(4, 9, 0, 6, -2, 3)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 2.1, color: C.ink, join: 'round' });
      graphics
        .moveTo(10, -4)
        .bezierCurveTo(18, -5, 26, -4, 32, -1)
        .bezierCurveTo(34, 1, 33, 4, 29, 4.5)
        .bezierCurveTo(22, 4, 17, 3, 11, 2)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 1.9, color: C.ink, join: 'round' });
      graphics.moveTo(6, -5).lineTo(8, 2).stroke({ width: 1.15, color: C.ink, alpha: 0.55, cap: 'round' });
      return;
    }

    if (pose === 'open') {
      const thumbY = 7 * side;
      graphics
        .moveTo(-2, -7)
        .bezierCurveTo(5, -11, 16, -10, 22, -4)
        .bezierCurveTo(27, 1, 24, 9, 16, 11)
        .bezierCurveTo(9, 13, 2, 9, -2, 4)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 2.15, color: C.ink, join: 'round' });
      graphics
        .moveTo(4, 5 * side)
        .bezierCurveTo(7, 10 * side, 12, 12 * side, 15, thumbY)
        .bezierCurveTo(13, 4 * side, 9, 2 * side, 5, 1 * side)
        .stroke({ width: 1.45, color: C.ink, alpha: 0.72, cap: 'round' });
      for (let index = 0; index < 3; index += 1) {
        const x = 9 + index * 4.2;
        graphics.moveTo(x, -6.3).bezierCurveTo(x + 1, -2.8, x + 1.2, 0.3, x + 0.8, 3.3);
      }
      graphics.stroke({ width: 1.05, color: C.ink, alpha: 0.5, cap: 'round' });
      return;
    }

    if (pose === 'emphasis') {
      graphics
        .moveTo(-2, -7)
        .bezierCurveTo(5, -10, 14, -8, 19, -3)
        .bezierCurveTo(22, 1, 20, 8, 14, 10)
        .bezierCurveTo(7, 12, 1, 8, -2, 3)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 2.1, color: C.ink, join: 'round' });
      graphics.moveTo(5, -4).bezierCurveTo(10, -7, 16, -6, 19, -1)
        .stroke({ width: 1.45, color: C.ink, cap: 'round' });
      return;
    }

    // Folded and relaxed hands are still directional mitten shapes instead of
    // detached circles, so the wrist reads as a continuation of the forearm.
    const relaxed = pose === 'relaxed';
    graphics
      .moveTo(-2, -6.5)
      .bezierCurveTo(4, -9.5, 12, -8.5, 16, -3.5)
      .bezierCurveTo(20, 1, 17, relaxed ? 8.5 : 7, 11, relaxed ? 10 : 8.5)
      .bezierCurveTo(5, relaxed ? 11 : 9.5, 0, 7, -2, 3)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 2.05, color: C.ink, join: 'round' });
    graphics.moveTo(4, -4).bezierCurveTo(8, -6.3, 13, -5.4, 16, -1)
      .stroke({ width: 1.3, color: C.ink, alpha: 0.68, cap: 'round' });
  }

  private sideForEffector(effector: string): Side {
    const value = effector.toLowerCase();
    if (value.includes('left')) return 'left';
    if (value.includes('right')) return 'right';
    throw new Error(`Milo has no effector named ${effector}`);
  }
}
