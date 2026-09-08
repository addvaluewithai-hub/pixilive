import { Container, Graphics } from 'pixi.js';
import type { PerformanceState } from './performance';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

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
  elbowVX: number;
  elbowVY: number;
  handVX: number;
  handVY: number;
  handRotationVelocity: number;
  handPose: HandPose;
}

const spring = (value: number, velocity: number, target: number, stiffness: number, damping: number, dt: number) => {
  velocity += (target - value) * stiffness * dt;
  velocity *= Math.exp(-damping * dt);
  value += velocity * dt;
  return [value, velocity] as const;
};

const springAngle = (value: number, velocity: number, target: number, stiffness: number, damping: number, dt: number) => {
  velocity += normalizeAngle(target - value) * stiffness * dt;
  velocity *= Math.exp(-damping * dt);
  value += velocity * dt;
  return [value, velocity] as const;
};

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
 * Art-directed procedural arm rig with spring follow-through.
 * Semantic gestures choose authored silhouettes; joints then travel with inertia
 * rather than linear tweening, keeping interruption and settling organic.
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
    const strength = clamp(state.gestureEnvelope * (0.8 + state.intensity * 0.3), 0, 1);
    const anticipation = state.gesturePhase < 0.14
      ? Math.sin((state.gesturePhase / 0.14) * Math.PI) * (0.4 + state.intensity * 0.6)
      : 0;

    const setActive = (target: JointPose) => {
      if (activeSide === -1) left = blendPose(left, target, strength);
      else right = blendPose(right, target, strength);
    };

    switch (state.gesture) {
      case 'explain':
        setActive({
          elbowX: activeSide * 88,
          elbowY: 53 + anticipation * 7,
          handX: activeSide * 136,
          handY: 31 + anticipation * 9,
          handRotation: activeSide * -0.14,
          hand: 'open',
        });
        break;

      case 'emphasize':
        setActive({
          elbowX: activeSide * 85,
          elbowY: 55 + anticipation * 6,
          handX: activeSide * 116,
          handY: 43 + anticipation * 6,
          handRotation: activeSide * -0.09,
          hand: 'emphasis',
        });
        break;

      case 'reassure':
        left = blendPose(left, {
          elbowX: -88,
          elbowY: 55 + anticipation * 6,
          handX: -61,
          handY: 76 + anticipation * 5,
          handRotation: 0.1,
          hand: 'open',
        }, strength);
        right = blendPose(right, {
          elbowX: 88,
          elbowY: 55 + anticipation * 6,
          handX: 61,
          handY: 76 + anticipation * 5,
          handRotation: -0.1,
          hand: 'open',
        }, strength);
        break;

      case 'think':
        right = blendPose(right, {
          elbowX: 91,
          elbowY: 42,
          handX: 46,
          handY: -61 + anticipation * 10,
          handRotation: -0.45,
          hand: 'relaxed',
        }, strength);
        break;

      case 'celebrate':
        left = blendPose(left, {
          elbowX: -94,
          elbowY: 24 + anticipation * 12,
          handX: -108,
          handY: -84 + anticipation * 14,
          handRotation: 0.14,
          hand: 'open',
        }, strength);
        right = blendPose(right, {
          elbowX: 94,
          elbowY: 24 + anticipation * 12,
          handX: 108,
          handY: -84 + anticipation * 14,
          handRotation: -0.14,
          hand: 'open',
        }, strength);
        break;

      case 'shrug':
        left = blendPose(left, {
          elbowX: -98,
          elbowY: 45 + anticipation * 7,
          handX: -140,
          handY: 13 + anticipation * 8,
          handRotation: -0.06,
          hand: 'open',
        }, strength);
        right = blendPose(right, {
          elbowX: 98,
          elbowY: 45 + anticipation * 7,
          handX: 140,
          handY: 13 + anticipation * 8,
          handRotation: 0.06,
          hand: 'open',
        }, strength);
        break;

      case 'greet':
      case 'goodbye': {
        const wave = Math.sin(state.gesturePhase * Math.PI * 5.2) * 0.2 * strength;
        right = blendPose(right, {
          elbowX: 93,
          elbowY: 36,
          handX: 111,
          handY: -74 + anticipation * 10,
          handRotation: -0.18 + wave,
          hand: 'open',
        }, strength);
        break;
      }

      case 'agree':
      case 'disagree':
        setActive({
          elbowX: activeSide * 85,
          elbowY: 55,
          handX: activeSide * 108,
          handY: 41,
          handRotation: activeSide * -0.07,
          hand: 'emphasis',
        });
        break;

      case 'none':
      default:
        break;
    }

    // Phrase accents stay intentionally small. Major gestures come from semantic
    // cues; prosody adds follow-through rather than constant waving.
    if (state.mode === 'speaking' && state.gestureEnvelope < 0.15 && state.speechBeat > 0.02) {
      const beat = state.speechBeat * (0.12 + state.intensity * 0.14);
      const accent: JointPose = {
        elbowX: activeSide * 83,
        elbowY: 57,
        handX: activeSide * 101,
        handY: 47,
        handRotation: activeSide * -0.055,
        hand: state.gesture === 'explain' ? 'open' : 'emphasis',
      };
      if (activeSide === -1) left = blendPose(left, accent, beat);
      else right = blendPose(right, accent, beat);
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
      elbowVX: 0,
      elbowVY: 0,
      handVX: 0,
      handVY: 0,
      handRotationVelocity: 0,
      handPose: 'folded',
    };
    this.drawHand(arm, 'folded');
    return arm;
  }

  private snap(arm: RigArm, target: JointPose) {
    arm.elbowX = target.elbowX;
    arm.elbowY = target.elbowY;
    arm.handX = target.handX;
    arm.handY = target.handY;
    arm.handRotation = target.handRotation;
    arm.elbowVX = arm.elbowVY = arm.handVX = arm.handVY = arm.handRotationVelocity = 0;
    arm.handPose = target.hand;
    this.renderArm(arm);
  }

  private updateArm(arm: RigArm, target: JointPose, dt: number) {
    [arm.elbowX, arm.elbowVX] = spring(arm.elbowX, arm.elbowVX, target.elbowX, 155, 18.5, dt);
    [arm.elbowY, arm.elbowVY] = spring(arm.elbowY, arm.elbowVY, target.elbowY, 155, 18.5, dt);
    [arm.handX, arm.handVX] = spring(arm.handX, arm.handVX, target.handX, 185, 20, dt);
    [arm.handY, arm.handVY] = spring(arm.handY, arm.handVY, target.handY, 185, 20, dt);
    [arm.handRotation, arm.handRotationVelocity] = springAngle(
      arm.handRotation,
      arm.handRotationVelocity,
      target.handRotation,
      190,
      19,
      dt,
    );

    if (arm.handPose !== target.hand) {
      arm.handPose = target.hand;
      this.drawHand(arm, target.hand);
    }
    this.renderArm(arm);
  }

  private renderArm(arm: RigArm) {
    arm.upper.clear();
    arm.forearm.clear();

    this.drawSegment(arm.upper, arm.shoulderX, arm.shoulderY, arm.elbowX, arm.elbowY, 11.2, C.ink, C.paper, 3.1);
    this.drawSegment(arm.forearm, arm.elbowX, arm.elbowY, arm.handX, arm.handY, 10.6, C.paper, C.ink, 3.2);

    arm.hand.position.set(arm.handX, arm.handY);
    arm.hand.rotation = arm.handRotation + clamp(arm.handRotationVelocity * 0.0025, -0.045, 0.045);
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
    const endWidth = halfWidth * 0.88;

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

  private drawHand(arm: RigArm, handPose: HandPose) {
    const g = arm.hand;
    const s = arm.side;
    g.clear();

    if (handPose === 'folded') {
      g.ellipse(0, 1, 11, 8).fill(C.paper).stroke({ width: 2.2, color: C.ink });
      g.moveTo(-7 * s, -2).bezierCurveTo(-3 * s, -8, 2 * s, -8, 6 * s, -2)
        .moveTo(-3 * s, 1).bezierCurveTo(1 * s, -5, 7 * s, -4, 9 * s, 1)
        .stroke({ width: 1.7, color: C.ink, cap: 'round' });
      return;
    }

    if (handPose === 'open') {
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

    if (handPose === 'emphasis') {
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
