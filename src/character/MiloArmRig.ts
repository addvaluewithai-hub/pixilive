import { Container, Graphics } from 'pixi.js';
import type { PerformanceState } from './performance';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

type HandPose = 'folded' | 'relaxed' | 'open' | 'emphasis';

interface ArmTargets {
  upper: number;
  forearm: number;
  shoulderY: number;
  hand: HandPose;
}

interface RigArm {
  root: Container;
  forearm: Container;
  hand: Graphics;
  mirror: 1 | -1;
  upperRotation: number;
  forearmRotation: number;
  shoulderY: number;
  handPose: HandPose;
}

const resting = (mirror: 1 | -1): ArmTargets => ({
  upper: mirror === 1 ? 0.015 : -0.015,
  forearm: mirror === 1 ? -0.035 : 0.035,
  shoulderY: mirror === 1 ? 3 : 5,
  hand: 'folded',
});

export class MiloArmRig {
  readonly view = new Container();
  private readonly left: RigArm;
  private readonly right: RigArm;

  constructor() {
    this.left = this.makeArm(-58, 1);
    this.right = this.makeArm(58, -1);
    this.view.addChild(this.left.root, this.right.root);
  }

  update(state: PerformanceState, dt: number) {
    const left = resting(1);
    const right = resting(-1);
    const strength = state.gestureEnvelope * (0.45 + state.intensity * 0.55);
    const variantRight = state.gestureVariant % 2 === 0;

    const active = variantRight ? right : left;
    const activeMirror = variantRight ? -1 : 1;

    switch (state.gesture) {
      case 'explain':
        active.upper += activeMirror * 0.12 * strength;
        active.forearm += activeMirror * -0.62 * strength;
        active.shoulderY -= 3 * strength;
        active.hand = 'open';
        break;
      case 'emphasize':
        active.upper += activeMirror * 0.07 * strength;
        active.forearm += activeMirror * -0.34 * strength;
        active.hand = 'emphasis';
        break;
      case 'reassure':
        left.forearm -= 0.24 * strength;
        right.forearm += 0.24 * strength;
        left.upper += 0.05 * strength;
        right.upper -= 0.05 * strength;
        left.hand = right.hand = 'open';
        break;
      case 'think':
        right.upper -= 0.09 * strength;
        right.forearm += 1.18 * strength;
        right.shoulderY -= 5 * strength;
        right.hand = 'relaxed';
        break;
      case 'celebrate':
        left.upper += 0.24 * strength;
        right.upper -= 0.24 * strength;
        left.forearm -= 0.98 * strength;
        right.forearm += 0.98 * strength;
        left.shoulderY -= 6 * strength;
        right.shoulderY -= 6 * strength;
        left.hand = right.hand = 'open';
        break;
      case 'shrug':
        left.upper += 0.2 * strength;
        right.upper -= 0.2 * strength;
        left.forearm -= 0.55 * strength;
        right.forearm += 0.55 * strength;
        left.shoulderY -= 5 * strength;
        right.shoulderY -= 5 * strength;
        left.hand = right.hand = 'open';
        break;
      case 'greet':
      case 'goodbye': {
        right.upper -= 0.12 * strength;
        right.forearm += 1.08 * strength;
        right.shoulderY -= 7 * strength;
        right.hand = 'open';
        const wave = Math.sin(state.gesturePhase * Math.PI * 8) * 0.13 * strength;
        right.forearm += wave;
        break;
      }
      case 'agree':
      case 'disagree':
        active.forearm += activeMirror * -0.12 * strength;
        active.hand = 'emphasis';
        break;
      case 'none':
      default:
        break;
    }

    // Prosodic accents are deliberately tiny. The body should never flap with every syllable.
    if (state.mode === 'speaking' && state.speechBeat > 0.02 && state.gestureEnvelope < 0.45) {
      const beat = state.speechBeat * 0.075;
      left.forearm -= beat;
      right.forearm += beat;
    }

    this.updateArm(this.left, left, dt);
    this.updateArm(this.right, right, dt);
  }

  private makeArm(shoulderX: number, mirror: 1 | -1): RigArm {
    const root = new Container();
    root.position.set(shoulderX, mirror === 1 ? 3 : 5);

    const upper = new Graphics()
      .moveTo(-12, -2)
      .bezierCurveTo(-15, 16, -14, 41, -10, 57)
      .bezierCurveTo(-3, 63, 5, 63, 11, 56)
      .bezierCurveTo(14, 35, 14, 14, 11, -2)
      .closePath()
      .fill(C.ink)
      .stroke({ width: 3.1, color: C.paper, alpha: 0.92, join: 'round' });
    root.addChild(upper);

    const forearm = new Container();
    forearm.y = 54;
    const reach = 106 * mirror;
    const half = 11;
    const forearmShape = new Graphics()
      .moveTo(0, -half)
      .bezierCurveTo(reach * 0.28, -half - 1, reach * 0.72, -half + 1, reach, -8)
      .bezierCurveTo(reach + 7 * mirror, -5, reach + 7 * mirror, 6, reach, 9)
      .bezierCurveTo(reach * 0.68, half + 2, reach * 0.25, half + 1, 0, half)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 3.2, color: C.ink, join: 'round' });
    forearm.addChild(forearmShape);

    const hand = new Graphics();
    hand.position.set(reach, 0);
    forearm.addChild(hand);
    root.addChild(forearm);

    const arm: RigArm = {
      root,
      forearm,
      hand,
      mirror,
      upperRotation: resting(mirror).upper,
      forearmRotation: resting(mirror).forearm,
      shoulderY: resting(mirror).shoulderY,
      handPose: 'folded',
    };
    this.drawHand(arm, 'folded');
    return arm;
  }

  private updateArm(arm: RigArm, target: ArmTargets, dt: number) {
    arm.upperRotation = damp(arm.upperRotation, target.upper, 7.8, dt);
    arm.forearmRotation = damp(arm.forearmRotation, target.forearm, 8.6, dt);
    arm.shoulderY = damp(arm.shoulderY, target.shoulderY, 7.2, dt);
    arm.root.rotation = arm.upperRotation;
    arm.root.y = arm.shoulderY;
    arm.forearm.rotation = arm.forearmRotation;
    if (arm.handPose !== target.hand) {
      arm.handPose = target.hand;
      this.drawHand(arm, target.hand);
    }
  }

  private drawHand(arm: RigArm, pose: HandPose) {
    const g = arm.hand;
    const s = arm.mirror;
    g.clear();

    if (pose === 'folded') {
      g.ellipse(2 * s, 0, 11, 8).fill(C.paper).stroke({ width: 2.2, color: C.ink });
      g.moveTo(-5 * s, -2).bezierCurveTo(-1 * s, -8, 4 * s, -8, 7 * s, -2)
        .moveTo(-1 * s, 1).bezierCurveTo(3 * s, -5, 8 * s, -4, 10 * s, 1)
        .stroke({ width: 1.7, color: C.ink, cap: 'round' });
      return;
    }

    if (pose === 'open') {
      g.moveTo(-3 * s, -8)
        .bezierCurveTo(5 * s, -12, 13 * s, -9, 15 * s, -2)
        .bezierCurveTo(16 * s, 5, 8 * s, 11, -1 * s, 8)
        .bezierCurveTo(-7 * s, 6, -8 * s, -3, -3 * s, -8)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 2.2, color: C.ink, join: 'round' });
      for (let index = 0; index < 3; index += 1) {
        const x = (3 + index * 4) * s;
        g.moveTo(x, -6 + index * 0.7).lineTo(x + 2 * s, 2 + index * 0.5);
      }
      g.stroke({ width: 1.35, color: C.ink, alpha: 0.75, cap: 'round' });
      return;
    }

    if (pose === 'emphasis') {
      g.ellipse(3 * s, 0, 10, 7).fill(C.paper).stroke({ width: 2.1, color: C.ink });
      g.moveTo(-2 * s, -3).bezierCurveTo(3 * s, -7, 9 * s, -5, 11 * s, 0)
        .stroke({ width: 1.6, color: C.ink, cap: 'round' });
      return;
    }

    g.ellipse(1 * s, 0, 10, 8).fill(C.paper).stroke({ width: 2.1, color: C.ink });
    g.moveTo(-3 * s, -2).bezierCurveTo(2 * s, -5, 7 * s, -4, 9 * s, 1)
      .stroke({ width: 1.55, color: C.ink, alpha: 0.8, cap: 'round' });
  }
}
