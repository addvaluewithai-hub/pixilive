import { Container, Graphics } from 'pixi.js';
import type { PerformanceState } from './performance';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const dampAngle = (from: number, to: number, speed: number, dt: number) =>
  from + normalizeAngle(to - from) * (1 - Math.exp(-speed * dt));

type HandPose = 'folded' | 'relaxed' | 'open' | 'emphasis';
type ArmSide = -1 | 1;

interface JointPose {
  elbowX: number;
  elbowY: number;
  handX: number;
  handY: number;
  handRotation: number;
  hand: HandPose;
}

interface RigArm {
  side: ArmSide;
  shoulderX: number;
  shoulderY: number;
  root: Container;
  upper: Graphics;
  forearm: Graphics;
  hand: Graphics;
  elbowX: number;
  elbowY: number;
  handX: number;
  handY: number;
  handRotation: number;
  handPose: HandPose;
}

const restPose = (side: ArmSide): JointPose =>
  side === -1
    ? { elbowX: -79, elbowY: 58, handX: 47, handY: 66, handRotation: -0.04, hand: 'folded' }
    : { elbowX: 79, elbowY: 60, handX: -47, handY: 70, handRotation: 0.04, hand: 'folded' };

const blendPose = (from: JointPose, to: JointPose, amount: number): JointPose => ({
  elbowX: lerp(from.elbowX, to.elbowX, amount),
  elbowY: lerp(from.elbowY, to.elbowY, amount),
  handX: lerp(from.handX, to.handX, amount),
  handY: lerp(from.handY, to.handY, amount),
  handRotation: lerp(from.handRotation, to.handRotation, amount),
  hand: amount > 0.18 ? to.hand : from.hand,
});

/**
 * Art-directed procedural arm rig.
 *
 * The character director gives us meaning. This rig turns that meaning into
 * authored shoulder/elbow/hand silhouettes and smoothly blends the joints.
 * Unlike generic IK, the elbow is intentionally placed by the animator so every
 * gesture reads cleanly in Milo's flat editorial drawing style.
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
    this.snap(this.left, restPose(-1));
    this.snap(this.right, restPose(1));
  }

  update(state: PerformanceState, dt: number) {
    let left = restPose(-1);
    let right = restPose(1);
    const activeSide: ArmSide = state.gestureVariant % 2 === 0 ? 1 : -1;
    const strength = clamp(state.gestureEnvelope * (0.78 + state.intensity * 0.32), 0, 1);
    const anticipation = state.gesturePhase < 0.14
      ? Math.sin((state.gesturePhase / 0.14) * Math.PI) * (0.4 + state.intensity * 0.6)
      : 0;

    const setActive = (pose: JointPose) => {
      if (activeSide === -1) left = blendPose(left, pose, strength);
      else right = blendPose(right, pose, strength);
    };

    switch (state.gesture) {
      case 'explain':
        setActive({
          elbowX: activeSide * 86,
          elbowY: 55 + anticipation * 7,
          handX: activeSide * 132,
          handY: 34 + anticipation * 9,
          handRotation: activeSide * -0.12,
          hand: 'open',
        });
        break;

      case 'emphasize':
        setActive({
          elbowX: activeSide * 84,
          elbowY: 57 + anticipation * 6,
          handX: activeSide * 111,
          handY: 49 + anticipation * 6,
          handRotation: activeSide * -0.08,
          hand: 'emphasis',
        });
        break;

      case 'reassure':
        left = blendPose(left, {
          elbowX: -87,
          elbowY: 56 + anticipation * 6,
          handX: -55,
          handY: 79 + anticipation * 5,
          handRotation: 0.08,
          hand: 'open',
        }, strength);
        right = blendPose(right, {
          elbowX: 87,
          elbowY: 56 + anticipation * 6,
          handX: 55,
          handY: 79 + anticipation * 5,
          handRotation: -0.08,
          hand: 'open',
        }, strength);
        break;

      case 'think':
        right = blendPose(right, {
          elbowX: 88,
          elbowY: 43,
          handX: 44,
          handY: -58 + anticipation * 10,
          handRotation: -0.42,
          hand: 'relaxed',
        }, strength);
        break;

      case 'celebrate':
        left = blendPose(left, {
          elbowX: -91,
          elbowY: 28 + anticipation * 12,
          handX: -104,
          handY: -78 + anticipation * 14,
          handRotation: 0.12,
          hand: 'open',
        }, strength);
        right = blendPose(right, {
          elbowX: 91,
          elbowY: 28 + anticipation * 12,
          handX: 104,
          handY: -78 + anticipation * 14,
          handRotation: -0.12,
          hand: 'open',
        }, strength);
        break;

      case 'shrug':
        left = blendPose(left, {
          elbowX: -94,
          elbowY: 48 + anticipation * 7,
          handX: -135,
          handY: 18 + anticipation * 8,
          handRotation: -0.04,
          hand: 'open',
        }, strength);
        right = blendPose(right, {
          elbowX: 94,
          elbowY: 48 + anticipation * 7,
          handX: 135,
          handY: 18 + anticipation * 8,
          handRotation: 0.04,
          hand: 'open',
        }, strength);
        break;

      case 'greet':
      case 'goodbye': {
        const wave = Math.sin(state.gesturePhase * Math.PI * 6) * 0.18 * strength;
        right = blendPose(right, {
          elbowX: 91,
          elbowY: 38,
          handX: 108,
          handY: -70 + anticipation * 10,
          handRotation: -0.18 + wave,
          hand: 'open',
        }, strength);
        break;
      }

      case 'agree':
      case 'disagree':
        setActive({
          elbowX: activeSide * 84,
          elbowY: 56,
          handX: activeSide * 103,
          handY: 44,
          handRotation: activeSide * -0.06,
          hand: 'emphasis',
        });
        break;

      case 'none':
      default:
        break;
    }

    // Long spoken turns get occasional small accents in the same gesture family.
    // The primary pose remains semantic; audio only nudges it on phrase-like peaks.
    if (state.mode === 'speaking' && state.gestureEnvelope < 0.15 && state.speechBeat > 0.02) {
      const beat = state.speechBeat * (0.14 + state.intensity * 0.16);
      if (state.gesture === 'explain' || state.gesture === 'emphasize' || state.gesture === 'agree' || state.gesture === 'disagree') {
        const accent: JointPose = {
          elbowX: activeSide * 83,
          elbowY: 58,
          handX: activeSide * 99,
          handY: 49,
          handRotation: activeSide * -0.05,
          hand: state.gesture === 'explain' ? 'open' : 'emphasis',
        };
        if (activeSide === -1) left = blendPose(left, accent, beat);
        else right = blendPose(right, accent, beat);
      } else if (state.gesture === 'reassure') {
        left = blendPose(left, { elbowX: -84, elbowY: 58, handX: -62, handY: 72, handRotation: 0.06, hand: 'open' }, beat * 0.7);
        right = blendPose(right, { elbowX: 84, elbowY: 58, handX: 62, handY: 72, handRotation: -0.06, hand: 'open' }, beat * 0.7);
      }
    }

    const twoHanded = ['reassure', 'celebrate', 'shrug'].includes(state.gesture);
    this.left.root.zIndex = twoHanded ? 2 : activeSide === -1 ? 4 : 1;
    this.right.root.zIndex = twoHanded ? 3 : activeSide === 1 ? 4 : 1;

    this.updateArm(this.left, left, dt);
    this.updateArm(this.right, right, dt);
  }

  private makeArm(shoulderX: number, shoulderY: number, side: ArmSide): RigArm {
    const root = new Container();
    const upper = new Graphics();
    const forearm = new Graphics();
    const hand = new Graphics();
    root.addChild(upper, forearm, hand);

    const arm: RigArm = {
      side,
      shoulderX,
      shoulderY,
      root,
      upper,
      forearm,
      hand,
      elbowX: shoulderX,
      elbowY: shoulderY + 55,
      handX: shoulderX,
      handY: shoulderY + 90,
      handRotation: 0,
      handPose: 'folded',
    };
    this.drawHand(arm, 'folded');
    return arm;
  }

  private snap(arm: RigArm, pose: JointPose) {
    arm.elbowX = pose.elbowX;
    arm.elbowY = pose.elbowY;
    arm.handX = pose.handX;
    arm.handY = pose.handY;
    arm.handRotation = pose.handRotation;
    arm.handPose = pose.hand;
    this.renderArm(arm);
  }

  private updateArm(arm: RigArm, target: JointPose, dt: number) {
    arm.elbowX = damp(arm.elbowX, target.elbowX, 9.6, dt);
    arm.elbowY = damp(arm.elbowY, target.elbowY, 9.6, dt);
    arm.handX = damp(arm.handX, target.handX, 10.8, dt);
    arm.handY = damp(arm.handY, target.handY, 10.8, dt);
    arm.handRotation = dampAngle(arm.handRotation, target.handRotation, 12, dt);

    if (arm.handPose !== target.hand) {
      arm.handPose = target.hand;
      this.drawHand(arm, target.hand);
    }
    this.renderArm(arm);
  }

  private renderArm(arm: RigArm) {
    arm.upper.clear();
    arm.forearm.clear();

    this.drawSegment(
      arm.upper,
      arm.shoulderX,
      arm.shoulderY,
      arm.elbowX,
      arm.elbowY,
      11,
      C.ink,
      C.paper,
      3.1,
    );
    this.drawSegment(
      arm.forearm,
      arm.elbowX,
      arm.elbowY,
      arm.handX,
      arm.handY,
      11,
      C.paper,
      C.ink,
      3.2,
    );

    arm.hand.position.set(arm.handX, arm.handY);
    arm.hand.rotation = arm.handRotation;
  }

  private drawSegment(
    graphics: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    halfWidth: number,
    fill: number,
    stroke: number,
    strokeWidth: number,
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / length;
    const py = dx / length;
    const endWidth = halfWidth * 0.9;

    graphics
      .moveTo(x1 + px * halfWidth, y1 + py * halfWidth)
      .bezierCurveTo(
        x1 + dx * 0.34 + px * halfWidth,
        y1 + dy * 0.34 + py * halfWidth,
        x1 + dx * 0.7 + px * endWidth,
        y1 + dy * 0.7 + py * endWidth,
        x2 + px * endWidth,
        y2 + py * endWidth,
      )
      .bezierCurveTo(
        x2 + dx * 0.035,
        y2 + dy * 0.035,
        x2 - dx * 0.035,
        y2 - dy * 0.035,
        x2 - px * endWidth,
        y2 - py * endWidth,
      )
      .bezierCurveTo(
        x1 + dx * 0.7 - px * endWidth,
        y1 + dy * 0.7 - py * endWidth,
        x1 + dx * 0.34 - px * halfWidth,
        y1 + dy * 0.34 - py * halfWidth,
        x1 - px * halfWidth,
        y1 - py * halfWidth,
      )
      .bezierCurveTo(
        x1 - dx * 0.035,
        y1 - dy * 0.035,
        x1 + dx * 0.035,
        y1 + dy * 0.035,
        x1 + px * halfWidth,
        y1 + py * halfWidth,
      )
      .closePath()
      .fill(fill)
      .stroke({ width: strokeWidth, color: stroke, join: 'round' });
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
