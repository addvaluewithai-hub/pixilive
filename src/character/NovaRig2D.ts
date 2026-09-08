import type { Container } from 'pixi.js';
import { Rig2D, SpringVec2, clamp, type Vec2 } from '../rig2d';
import type { CharacterInteractionCapabilities, CharacterInteractionController, ReachOptions } from './runtime';
import type { CharacterGesture, PerformanceState } from './performance';

type Side = 'left' | 'right';

interface ManualReach {
  target: Vec2;
  options: ReachOptions;
}

const SHOULDER: Record<Side, Vec2> = {
  left: { x: -71, y: 20 },
  right: { x: 71, y: 20 },
};

const REST_ROTATION: Record<Side, number> = {
  left: Math.PI / 2 + 0.055,
  right: Math.PI / 2 - 0.055,
};

const REST_TARGET: Record<Side, Vec2> = {
  left: { x: -76, y: 118 },
  right: { x: 76, y: 118 },
};

const activeSideFor = (state: PerformanceState): Side => state.gestureVariant % 2 === 0 ? 'right' : 'left';
const mix = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Nova's physical adapter for the same renderer-independent interaction API Milo
 * uses. Nova has simple stylized one-bone arms, so Rig2D solves aim constraints
 * instead of humanoid two-bone IK. Semantic intent stays identical.
 */
export class NovaRig2D implements CharacterInteractionController {
  readonly capabilities: CharacterInteractionCapabilities = {
    effectors: ['leftHand', 'rightHand'],
    attachments: ['leftPalm', 'rightPalm'],
    locomotion: ['idle', 'hover'],
    actions: ['openArms', 'explain', 'emphasize', 'reassure', 'celebrate', 'shrug', 'greet', 'touchFace'],
  };

  private readonly rig = new Rig2D([
    { name: 'root' },
    { name: 'armL', parent: 'root', anchor: 'origin', x: SHOULDER.left.x, y: SHOULDER.left.y, rotation: REST_ROTATION.left, length: 98 },
    { name: 'armR', parent: 'root', anchor: 'origin', x: SHOULDER.right.x, y: SHOULDER.right.y, rotation: REST_ROTATION.right, length: 98 },
  ], [
    { name: 'leftPalm', bone: 'armL', x: 98 },
    { name: 'rightPalm', bone: 'armR', x: 98 },
  ]);

  private readonly spring = {
    left: new SpringVec2(REST_TARGET.left),
    right: new SpringVec2(REST_TARGET.right),
  };
  private readonly manual = new Map<Side, ManualReach>();
  private forcedAction: CharacterGesture | null = null;
  private forcedIntensity = 0;
  private locomotion = 'idle';

  constructor(
    private readonly armLeft: Container,
    private readonly armRight: Container,
  ) {}

  reach(effector: string, target: Vec2, options: ReachOptions = {}) {
    this.manual.set(this.sideForEffector(effector), { target: { ...target }, options: { ...options } });
  }

  clearReach(effector?: string) {
    if (!effector) this.manual.clear();
    else this.manual.delete(this.sideForEffector(effector));
  }

  pointAt(target: Vec2, effector = 'rightHand') {
    this.manual.set(this.sideForEffector(effector), { target: { ...target }, options: { hold: true, weight: 1 } });
  }

  attach(effector: string, target: Vec2) {
    this.manual.set(this.sideForEffector(effector), { target: { ...target }, options: { hold: true, weight: 1 } });
  }

  detach(effector?: string) { this.clearReach(effector); }

  action(name: string, intensity = 0.78) {
    const map: Record<string, CharacterGesture> = {
      openArms: 'reassure',
      explain: 'explain',
      emphasize: 'emphasize',
      reassure: 'reassure',
      celebrate: 'celebrate',
      shrug: 'shrug',
      greet: 'greet',
      touchFace: 'think',
    };
    this.forcedAction = map[name] ?? null;
    this.forcedIntensity = clamp(intensity, 0, 1);
  }

  setLocomotion(name: string) {
    this.locomotion = this.capabilities.locomotion.includes(name) ? name : 'idle';
  }

  update(state: PerformanceState, dt: number) {
    this.rig.resetToRest();
    const gesture = this.forcedAction ?? state.gesture;
    const envelope = this.forcedAction ? this.forcedIntensity : state.gestureEnvelope;
    const intensity = this.forcedAction ? this.forcedIntensity : state.intensity;
    const targets = this.targetsFor(gesture, activeSideFor(state), clamp(envelope * (0.62 + intensity * 0.38), 0, 1), state.gesturePhase);

    for (const side of ['left', 'right'] as const) {
      const manual = this.manual.get(side);
      const desired = manual?.target ?? targets[side];
      const target = this.spring[side].update(desired, dt, manual ? 8.5 : 6.2, 0.86);
      const bone = side === 'left' ? 'armL' : 'armR';
      this.rig.solveAim({ bone, target, weight: manual?.options.weight ?? 1 });
      const rotation = this.rig.getBone(bone).worldRotation - Math.PI / 2;
      (side === 'left' ? this.armLeft : this.armRight).rotation = rotation;
    }

    if (this.forcedAction) {
      this.forcedIntensity *= Math.exp(-Math.max(0, dt) * 1.05);
      if (this.forcedIntensity < 0.055) this.forcedAction = null;
    }

    void this.locomotion;
  }

  debugSnapshot() { return this.rig.debugSnapshot(); }

  private targetsFor(gesture: CharacterGesture, activeSide: Side, amount: number, phase: number): Record<Side, Vec2> {
    const targets = { left: { ...REST_TARGET.left }, right: { ...REST_TARGET.right } };
    const set = (side: Side, target: Vec2, weight = amount) => { targets[side] = mix(targets[side], target, clamp(weight, 0, 1)); };
    const sign = activeSide === 'left' ? -1 : 1;

    switch (gesture) {
      case 'explain':
        set(activeSide, { x: sign * 145, y: 48 });
        break;
      case 'emphasize':
      case 'agree':
      case 'disagree':
        set(activeSide, { x: sign * 126, y: 30 });
        break;
      case 'reassure':
        set('left', { x: -142, y: 54 });
        set('right', { x: 142, y: 54 });
        break;
      case 'think':
        set('right', { x: 36, y: -74 });
        break;
      case 'celebrate':
        set('left', { x: -102, y: -105 });
        set('right', { x: 102, y: -105 });
        break;
      case 'shrug':
        set('left', { x: -146, y: 12 });
        set('right', { x: 146, y: 12 });
        break;
      case 'greet':
      case 'goodbye': {
        const wave = Math.sin(phase * Math.PI * 5) * 12;
        set('right', { x: 112 + wave, y: -92 });
        break;
      }
      default:
        break;
    }
    return targets;
  }

  private sideForEffector(effector: string): Side {
    const name = effector.toLowerCase();
    if (name.includes('left')) return 'left';
    if (name.includes('right')) return 'right';
    throw new Error(`Nova has no effector named ${effector}`);
  }
}
