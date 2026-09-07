import { Container, Graphics } from 'pixi.js';
import type { PerformanceState } from './performance';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
const UPPER_LENGTH = 60;
const FOREARM_LENGTH = 106;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const dampAngle = (from: number, to: number, speed: number, dt: number) =>
  from + normalizeAngle(to - from) * (1 - Math.exp(-speed * dt));

type HandPose = 'folded' | 'relaxed' | 'open' | 'emphasis';
type ArmSide = -1 | 1; // -1 = left, +1 = right

interface HandTarget {
  x: number;
  y: number;
  rotation: number;
  hand: HandPose;
}

interface RigArm {
  side: ArmSide;
  shoulderX: number;
  shoulderY: number;
  root: Container;
  forearm: Container;
  hand: Graphics;
  upperRotation: number;
  forearmRotation: number;
  handRotation: number;
  handPose: HandPose;
}

const restTarget = (side: ArmSide): HandTarget =>
  side === -1
    ? { x: 47, y: 67, rotation: -0.06, hand: 'folded' }
    : { x: -47, y: 70, rotation: 0.06, hand: 'folded' };

const blendTarget = (from: HandTarget, to: HandTarget, amount: number): HandTarget => ({
  x: lerp(from.x, to.x, amount),
  y: lerp(from.y, to.y, amount),
  rotation: lerp(from.rotation, to.rotation, amount),
  hand: amount > 0.2 ? to.hand : from.hand,
});

/**
 * A real two-bone arm rig for Milo.
 *
 * Gestures are authored as hand targets in character space. A tiny IK solver
 * derives shoulder and elbow angles every frame. That makes the poses readable
 * (hands can genuinely leave the crossed-arm silhouette) while keeping every
 * transition interruptible and naturally damped.
 */
export class MiloArmRig {
  readonly view = new Container();
  private readonly left: RigArm;
  private readonly right: RigArm;

  constructor() {
    this.view.sortableChildren = true;
    this.left = this.makeArm(-58, 3, -1);
    this.right = this.makeArm(58, 5, 1);
    this.view.addChild(this.left.root, this.right.root);

    // Start in the real crossed-arm pose instead of animating in from zero.
    this.snapToTarget(this.left, restTarget(-1));
    this.snapToTarget(this.right, restTarget(1));
  }

  update(state: PerformanceState, dt: number) {
    let left = restTarget(-1);
    let right = restTarget(1);

    const activeSide: ArmSide = state.gestureVariant % 2 === 0 ? 1 : -1;
    const intensityGain = 0.72 + state.intensity * 0.38;
    const action = clamp(state.gestureEnvelope * intensityGain, 0, 1);
    const anticipation = state.gesturePhase < 0.14
      ? Math.sin((state.gesturePhase / 0.14) * Math.PI) * (0.4 + state.intensity * 0.6)
      : 0;

    const activeRest = restTarget(activeSide);
    const passiveSide: ArmSide = activeSide === 1 ? -1 : 1;
    const passiveRest = restTarget(passiveSide);

    const targetFor = (side: ArmSide, target: HandTarget) => {
      const from = side === -1 ? left : right;
      const blended = blendTarget(from, target, action);
      if (side === -1) left = blended;
      else right = blended;
    };

    switch (state.gesture) {
      case 'explain': {
        const target: HandTarget = {
          x: activeSide * 121,
          y: 20,
          rotation: activeSide * -0.16,
          hand: 'open',
        };
        target.x -= activeSide * anticipation * 12;
        target.y += anticipation * 9;
        targetFor(activeSide, target);
        break;
      }
      case 'emphasize': {
        const target: HandTarget = {
          x: activeSide * 104,
          y: 43,
          rotation: activeSide * -0.1,
          hand: 'emphasis',
        };
        target.x -= activeSide * anticipation * 10;
        target.y += anticipation * 7;
        targetFor(activeSide, target);
        break;
      }
      case 'reassure': {
        const leftTarget: HandTarget = { x: -92, y: 25 + anticipation * 7, rotation: 0.12, hand: 'open' };
        const rightTarget: HandTarget = { x: 92, y: 25 + anticipation * 7, rotation: -0.12, hand: 'open' };
        left = blendTarget(left, leftTarget, action);
        right = blendTarget(right, rightTarget, action);
        break;
      }
      case 'think': {
        const target: HandTarget = { x: 37, y: -76, rotation: -0.4, hand: 'relaxed' };
        target.y += anticipation * 12;
        right = blendTarget(right, target, action);
        break;
      }
      case 'celebrate': {
        const dip = anticipation * 13;
        left = blendTarget(left, { x: -94, y: -75 + dip, rotation: 0.18, hand: 'open' }, action);
        right = blendTarget(right, { x: 94, y: -75 + dip, rotation: -0.18, hand: 'open' }, action);
        break;
      }
      case 'shrug': {
        const dip = anticipation * 8;
        left = blendTarget(left, { x: -130, y: 6 + dip, rotation: -0.06, hand: 'open' }, action);
        right = blendTarget(right, { x: 130, y: 6 + dip, rotation: 0.06, hand: 'open' }, action);
        break;
      }
      case 'greet':
      case 'goodbye': {
        const wave = Math.sin(state.gesturePhase * Math.PI * 6) * 0.17 * action;
        right = blendTarget(
          right,
          { x: 108, y: -67 + anticipation * 10, rotation: -0.24 + wave, hand: 'open' },
          action,
        );
        break;
      }
      case 'agree':
      case 'disagree': {
        const target: HandTarget = {
          x: activeSide * 94,
          y: 42,
          rotation: activeSide * -0.06,
          hand: 'emphasis',
        };
        targetFor(activeSide, target);
        break;
      }
      case 'none':
      default:
        break;
    }

    // After the main semantic gesture, prosodic peaks can create small hand
    // accents in the same gesture family. This keeps a longer spoken answer alive
    // without asking Gemini to choreograph individual words.
    if (state.mode === 'speaking' && state.gestureEnvelope < 0.16 && state.speechBeat > 0.02) {
      const beatAmount = state.speechBeat * (0.14 + state.intensity * 0.14);
      if (state.gesture === 'explain' || state.gesture === 'emphasize' || state.gesture === 'agree' || state.gesture === 'disagree') {
        const accent: HandTarget = {
          x: activeSide * 91,
          y: 49,
          rotation: activeSide * -0.05,
          hand: state.gesture === 'explain' ? 'open' : 'emphasis',
        };
        if (activeSide === -1) left = blendTarget(activeRest, accent, beatAmount);
        else right = blendTarget(activeRest, accent, beatAmount);
      } else if (state.gesture === 'reassure') {
        left = blendTarget(left, { x: -73, y: 48, rotation: 0.08, hand: 'open' }, beatAmount * 0.65);
        right = blendTarget(right, { x: 73, y: 48, rotation: -0.08, hand: 'open' }, beatAmount * 0.65);
      }
    }

    // Keep the non-active arm in front/behind in a way that makes the active
    // gesture readable. During two-handed gestures both remain equally visible.
    const twoHanded = ['reassure', 'celebrate', 'shrug'].includes(state.gesture);
    this.left.root.zIndex = twoHanded ? 2 : activeSide === -1 ? 4 : 1;
    this.right.root.zIndex = twoHanded ? 3 : activeSide === 1 ? 4 : 1;

    // Keep passive target explicit for type/readability; it also documents that
    // one-handed gestures intentionally leave the other arm folded.
    void passiveRest;

    this.updateArm(this.left, left, dt);
    this.updateArm(this.right, right, dt);
  }

  private makeArm(shoulderX: number, shoulderY: number, side: ArmSide): RigArm {
    const root = new Container();
    root.position.set(shoulderX, shoulderY);

    const upper = new Graphics()
      .moveTo(-11, -3)
      .bezierCurveTo(-14, 15, -13, 40, -10, UPPER_LENGTH - 4)
      .bezierCurveTo(-4, UPPER_LENGTH + 3, 4, UPPER_LENGTH + 3, 10, UPPER_LENGTH - 4)
      .bezierCurveTo(13, 39, 14, 15, 11, -3)
      .closePath()
      .fill(C.ink)
      .stroke({ width: 3.1, color: C.paper, alpha: 0.92, join: 'round' });
    root.addChild(upper);

    const forearm = new Container();
    forearm.position.set(0, UPPER_LENGTH);
    const forearmShape = new Graphics()
      .moveTo(-11, -3)
      .bezierCurveTo(-13, 24, -12, FOREARM_LENGTH - 25, -9, FOREARM_LENGTH - 6)
      .bezierCurveTo(-5, FOREARM_LENGTH + 3, 5, FOREARM_LENGTH + 3, 9, FOREARM_LENGTH - 6)
      .bezierCurveTo(12, FOREARM_LENGTH - 25, 13, 24, 11, -3)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 3.2, color: C.ink, join: 'round' });
    forearm.addChild(forearmShape);

    const hand = new Graphics();
    hand.position.set(0, FOREARM_LENGTH);
    forearm.addChild(hand);
    root.addChild(forearm);

    const arm: RigArm = {
      side,
      shoulderX,
      shoulderY,
      root,
      forearm,
      hand,
      upperRotation: 0,
      forearmRotation: 0,
      handRotation: 0,
      handPose: 'folded',
    };
    this.drawHand(arm, 'folded');
    return arm;
  }

  private snapToTarget(arm: RigArm, target: HandTarget) {
    const solved = this.solve(arm, target);
    arm.upperRotation = solved.upper;
    arm.forearmRotation = solved.forearm;
    arm.handRotation = solved.hand;
    arm.root.rotation = solved.upper;
    arm.forearm.rotation = solved.forearm;
    arm.hand.rotation = solved.hand;
  }

  private updateArm(arm: RigArm, target: HandTarget, dt: number) {
    const solved = this.solve(arm, target);
    arm.upperRotation = dampAngle(arm.upperRotation, solved.upper, 9.4, dt);
    arm.forearmRotation = dampAngle(arm.forearmRotation, solved.forearm, 10.8, dt);
    arm.handRotation = dampAngle(arm.handRotation, solved.hand, 12.5, dt);

    arm.root.position.set(arm.shoulderX, arm.shoulderY);
    arm.root.rotation = arm.upperRotation;
    arm.forearm.rotation = arm.forearmRotation;
    arm.hand.rotation = arm.handRotation;

    if (arm.handPose !== target.hand) {
      arm.handPose = target.hand;
      this.drawHand(arm, target.hand);
    }
  }

  private solve(arm: RigArm, target: HandTarget) {
    let dx = target.x - arm.shoulderX;
    let dy = target.y - arm.shoulderY;
    const rawDistance = Math.hypot(dx, dy) || 0.001;
    const minReach = Math.abs(FOREARM_LENGTH - UPPER_LENGTH) + 1;
    const maxReach = FOREARM_LENGTH + UPPER_LENGTH - 1;
    const distance = clamp(rawDistance, minReach, maxReach);
    const scale = distance / rawDistance;
    dx *= scale;
    dy *= scale;

    const base = Math.atan2(dy, dx);
    const shoulderCos = clamp(
      (UPPER_LENGTH ** 2 + distance ** 2 - FOREARM_LENGTH ** 2) / (2 * UPPER_LENGTH * distance),
      -1,
      1,
    );
    const offset = Math.acos(shoulderCos);
    const candidates = [base + offset, base - offset];

    // Prefer the elbow solution that sits toward the outside of the body. This
    // preserves Milo's recognizable silhouette both crossed and opened up.
    let upperWorld = candidates[0];
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const elbowX = Math.cos(candidate) * UPPER_LENGTH;
      const elbowY = Math.sin(candidate) * UPPER_LENGTH;
      const score = arm.side * elbowX + elbowY * 0.12;
      if (score > bestScore) {
        bestScore = score;
        upperWorld = candidate;
      }
    }

    const elbowX = Math.cos(upperWorld) * UPPER_LENGTH;
    const elbowY = Math.sin(upperWorld) * UPPER_LENGTH;
    const forearmWorld = Math.atan2(dy - elbowY, dx - elbowX);

    const upperRotation = normalizeAngle(upperWorld - Math.PI / 2);
    const forearmRotation = normalizeAngle(forearmWorld - upperWorld);
    const forearmXAxisWorld = forearmWorld - Math.PI / 2;
    const handRotation = normalizeAngle(target.rotation - forearmXAxisWorld);

    return { upper: upperRotation, forearm: forearmRotation, hand: handRotation };
  }

  private drawHand(arm: RigArm, pose: HandPose) {
    const g = arm.hand;
    const s = arm.side;
    g.clear();

    if (pose === 'folded') {
      g.ellipse(0, 1, 11, 8).fill(C.paper).stroke({ width: 2.2, color: C.ink });
      g.moveTo(-7 * s, -2).bezierCurveTo(-3 * s, -8, 2 * s, -8, 6 * s, -2)
        .moveTo(-3 * s, 1).bezierCurveTo(1 * s, -5, 7 * s, -4, 9 * s, 1)
        .stroke({ width: 1.7, color: C.ink, cap: 'round' });
      return;
    }

    if (pose === 'open') {
      g.moveTo(-10 * s, -7)
        .bezierCurveTo(-2 * s, -13, 9 * s, -11, 14 * s, -3)
        .bezierCurveTo(18 * s, 4, 10 * s, 13, 0, 11)
        .bezierCurveTo(-8 * s, 9, -14 * s, 0, -10 * s, -7)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 2.2, color: C.ink, join: 'round' });
      for (let index = 0; index < 3; index += 1) {
        const x = (-2 + index * 5) * s;
        g.moveTo(x, -7 + index * 0.5).lineTo(x + 3 * s, 2 + index * 0.7);
      }
      g.stroke({ width: 1.3, color: C.ink, alpha: 0.72, cap: 'round' });
      return;
    }

    if (pose === 'emphasis') {
      g.ellipse(1 * s, 1, 11, 8).fill(C.paper).stroke({ width: 2.1, color: C.ink });
      g.moveTo(-6 * s, -3).bezierCurveTo(-1 * s, -8, 7 * s, -6, 10 * s, 0)
        .stroke({ width: 1.6, color: C.ink, cap: 'round' });
      return;
    }

    g.ellipse(0, 1, 10.5, 8.5).fill(C.paper).stroke({ width: 2.1, color: C.ink });
    g.moveTo(-6 * s, -2).bezierCurveTo(-1 * s, -6, 6 * s, -5, 9 * s, 1)
      .stroke({ width: 1.55, color: C.ink, alpha: 0.8, cap: 'round' });
  }
}
