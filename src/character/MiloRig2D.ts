import { Container, Graphics } from 'pixi.js';
import { Rig2D, SpringVec2, clamp, type Vec2 } from '../rig2d';
import type { CharacterInteractionCapabilities, CharacterInteractionController, ReachOptions } from './runtime';
import type { CharacterGesture, PerformanceState } from './performance';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
type Side = 'left' | 'right';
type HandPose = 'folded' | 'relaxed' | 'open' | 'emphasis';

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

const REST: Record<Side, HandTarget> = {
  left: { position: { x: 48, y: 68 }, rotation: -0.04, pose: 'folded' },
  right: { position: { x: -48, y: 70 }, rotation: 0.04, pose: 'folded' },
};

const SHOULDER: Record<Side, Vec2> = {
  left: { x: -58, y: 3 },
  right: { x: 58, y: 5 },
};

const POLE: Record<Side, Vec2> = {
  left: { x: -125, y: 88 },
  right: { x: 125, y: 88 },
};

const cloneTarget = (target: HandTarget): HandTarget => ({
  position: { ...target.position },
  rotation: target.rotation,
  pose: target.pose,
});

const activeSideFor = (state: PerformanceState): Side => state.gestureVariant % 2 === 0 ? 'right' : 'left';

/**
 * Milo's first production Rig2D consumer.
 *
 * Art stays procedural Pixi geometry, while skeletal math is generic. Every
 * frame starts from the same rest skeleton; semantic gestures only move end
 * effectors and the IK solver preserves limb lengths and joint continuity.
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
    { name: 'upperArmL', parent: 'shoulderL', anchor: 'origin', length: 70, minRotation: -2.95, maxRotation: 2.95 },
    { name: 'forearmL', parent: 'upperArmL', anchor: 'end', length: 120, minRotation: -2.85, maxRotation: 2.85 },
    { name: 'handL', parent: 'forearmL', anchor: 'end' },
    { name: 'shoulderR', parent: 'root', anchor: 'origin', x: SHOULDER.right.x, y: SHOULDER.right.y },
    { name: 'upperArmR', parent: 'shoulderR', anchor: 'origin', length: 70, minRotation: -2.95, maxRotation: 2.95 },
    { name: 'forearmR', parent: 'upperArmR', anchor: 'end', length: 120, minRotation: -2.85, maxRotation: 2.85 },
    { name: 'handR', parent: 'forearmR', anchor: 'end' },
  ], [
    { name: 'leftPalm', bone: 'handL' },
    { name: 'rightPalm', bone: 'handR' },
  ]);

  private readonly leftUpper = new Graphics();
  private readonly leftForearm = new Graphics();
  private readonly leftHand = new Graphics();
  private readonly rightUpper = new Graphics();
  private readonly rightForearm = new Graphics();
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

  constructor() {
    this.view.sortableChildren = true;
    this.leftUpper.zIndex = 1;
    this.rightUpper.zIndex = 1;
    this.leftForearm.zIndex = 2;
    this.rightForearm.zIndex = 2;
    this.leftHand.zIndex = 3;
    this.rightHand.zIndex = 3;
    this.view.addChild(this.leftUpper, this.rightUpper, this.leftForearm, this.rightForearm, this.leftHand, this.rightHand);
    this.updateSkeleton({} as PerformanceState, 0);
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
    this.manual.set(side, { target: { ...target }, options: { hold: true, weight: 1 }, pose: 'emphasis' });
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
    const intensity = this.forcedAction ? this.forcedActionIntensity : safeState.intensity;
    const envelope = this.forcedAction ? 1 : safeState.gestureEnvelope;
    const activeSide = activeSideFor(safeState);
    const targets = this.targetsForGesture(gesture, activeSide, envelope, intensity, safeState.gesturePhase);

    for (const side of ['left', 'right'] as const) {
      const manual = this.manual.get(side);
      const desired = manual ? {
        position: manual.target,
        rotation: targets[side].rotation,
        pose: manual.pose,
      } : targets[side];
      const spring = this.targetSpring[side].update(desired.position, dt, manual ? 8.2 : 5.4, manual ? 0.9 : 0.84);
      this.handPose[side] = desired.pose;
      this.handRotation[side] = desired.rotation;

      const upper = side === 'left' ? 'upperArmL' : 'upperArmR';
      const lower = side === 'left' ? 'forearmL' : 'forearmR';
      this.rig.solveTwoBoneIK({
        upper,
        lower,
        target: spring,
        pole: POLE[side],
        weight: manual?.options.weight ?? 1,
      });
    }

    if (this.forcedAction) {
      this.forcedActionIntensity *= Math.exp(-Math.max(0, dt) * 1.6);
      if (this.forcedActionIntensity < 0.08) this.forcedAction = null;
    }

    void this.locomotion;
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
        blend(activeSide, { position: { x: sign * 145, y: 34 }, rotation: -sign * 0.12, pose: 'open' });
        break;
      case 'emphasize':
      case 'agree':
      case 'disagree':
        blend(activeSide, { position: { x: sign * 116, y: 47 }, rotation: -sign * 0.08, pose: 'emphasis' });
        break;
      case 'reassure':
        blend('left', { position: { x: -66, y: 82 }, rotation: 0.08, pose: 'open' });
        blend('right', { position: { x: 66, y: 82 }, rotation: -0.08, pose: 'open' });
        break;
      case 'think':
        blend('right', { position: { x: 45, y: -61 }, rotation: -0.36, pose: 'relaxed' });
        break;
      case 'celebrate':
        blend('left', { position: { x: -108, y: -86 }, rotation: 0.12, pose: 'open' });
        blend('right', { position: { x: 108, y: -86 }, rotation: -0.12, pose: 'open' });
        break;
      case 'shrug':
        blend('left', { position: { x: -142, y: 14 }, rotation: -0.04, pose: 'open' });
        blend('right', { position: { x: 142, y: 14 }, rotation: 0.04, pose: 'open' });
        break;
      case 'greet':
      case 'goodbye': {
        const wave = Math.sin(phase * Math.PI * 6) * 8;
        blend('right', { position: { x: 111 + wave, y: -70 }, rotation: -0.18 + wave * 0.008, pose: 'open' });
        break;
      }
      case 'none':
      default:
        break;
    }
    return targets;
  }

  private render() {
    const leftUpper = this.rig.getBone('upperArmL');
    const leftForearm = this.rig.getBone('forearmL');
    const rightUpper = this.rig.getBone('upperArmR');
    const rightForearm = this.rig.getBone('forearmR');

    this.drawSegment(this.leftUpper, leftUpper.start, leftUpper.end, 11.2, C.ink, C.paper, 3.1);
    this.drawSegment(this.leftForearm, leftForearm.start, leftForearm.end, 10.7, C.paper, C.ink, 3.15);
    this.drawSegment(this.rightUpper, rightUpper.start, rightUpper.end, 11.2, C.ink, C.paper, 3.1);
    this.drawSegment(this.rightForearm, rightForearm.start, rightForearm.end, 10.7, C.paper, C.ink, 3.15);

    this.drawHand(this.leftHand, this.rig.getBone('handL').start, this.handRotation.left, this.handPose.left, -1);
    this.drawHand(this.rightHand, this.rig.getBone('handR').start, this.handRotation.right, this.handPose.right, 1);
  }

  private drawSegment(graphics: Graphics, start: Vec2, end: Vec2, halfWidth: number, fill: number, stroke: number, strokeWidth: number) {
    graphics.clear();
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / length;
    const py = dx / length;
    const endWidth = halfWidth * 0.88;
    graphics
      .moveTo(start.x + px * halfWidth, start.y + py * halfWidth)
      .bezierCurveTo(
        start.x + dx * 0.32 + px * halfWidth, start.y + dy * 0.32 + py * halfWidth,
        start.x + dx * 0.72 + px * endWidth, start.y + dy * 0.72 + py * endWidth,
        end.x + px * endWidth, end.y + py * endWidth,
      )
      .bezierCurveTo(end.x + dx * 0.025, end.y + dy * 0.025, end.x - dx * 0.025, end.y - dy * 0.025, end.x - px * endWidth, end.y - py * endWidth)
      .bezierCurveTo(
        start.x + dx * 0.72 - px * endWidth, start.y + dy * 0.72 - py * endWidth,
        start.x + dx * 0.32 - px * halfWidth, start.y + dy * 0.32 - py * halfWidth,
        start.x - px * halfWidth, start.y - py * halfWidth,
      )
      .bezierCurveTo(start.x - dx * 0.025, start.y - dy * 0.025, start.x + dx * 0.025, start.y + dy * 0.025, start.x + px * halfWidth, start.y + py * halfWidth)
      .closePath()
      .fill(fill)
      .stroke({ width: strokeWidth, color: stroke, join: 'round' });
  }

  private drawHand(graphics: Graphics, position: Vec2, rotation: number, pose: HandPose, side: -1 | 1) {
    graphics.clear();
    graphics.position.set(position.x, position.y);
    graphics.rotation = rotation;

    if (pose === 'open') {
      graphics
        .moveTo(-10 * side, -7)
        .bezierCurveTo(-2 * side, -13, 9 * side, -11, 14 * side, -3)
        .bezierCurveTo(18 * side, 4, 10 * side, 13, 0, 11)
        .bezierCurveTo(-8 * side, 9, -14 * side, 0, -10 * side, -7)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 2.2, color: C.ink, join: 'round' });
      for (let index = 0; index < 3; index += 1) {
        const x = (-2 + index * 5) * side;
        graphics.moveTo(x, -7 + index * 0.5).lineTo(x + 3 * side, 2 + index * 0.7);
      }
      graphics.stroke({ width: 1.25, color: C.ink, alpha: 0.65, cap: 'round' });
      return;
    }

    graphics.ellipse(0, 1, pose === 'folded' ? 10.5 : 11, 8).fill(C.paper).stroke({ width: 2.1, color: C.ink });
    if (pose === 'emphasis') {
      graphics.moveTo(-6 * side, -3).bezierCurveTo(-1 * side, -8, 7 * side, -6, 10 * side, 0)
        .stroke({ width: 1.55, color: C.ink, cap: 'round' });
    } else {
      graphics.moveTo(-6 * side, -2).bezierCurveTo(-1 * side, -6, 6 * side, -5, 9 * side, 1)
        .stroke({ width: 1.45, color: C.ink, alpha: 0.75, cap: 'round' });
    }
  }

  private sideForEffector(effector: string): Side {
    const value = effector.toLowerCase();
    if (value.includes('left')) return 'left';
    if (value.includes('right')) return 'right';
    throw new Error(`Milo has no effector named ${effector}`);
  }
}
