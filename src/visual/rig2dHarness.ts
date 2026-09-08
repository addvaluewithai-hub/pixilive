import { Application, type Ticker } from 'pixi.js';
import { DirectedMiloCharacter } from '../character/DirectedMiloCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';
import { Rig2D, type Vec2 } from '../rig2d';

interface HarnessWindow {
  __pixiliveRigApp?: Application;
}

const fixedTicker = { deltaMS: 1000 / 60 } as Ticker;

const assertNear = (actual: number, expected: number, tolerance: number, label: string) => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected.toFixed(3)}, got ${actual}`);
  }
};

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function validateRig2DInvariants() {
  const rig = new Rig2D([
    { name: 'root' },
    { name: 'shoulder', parent: 'root', anchor: 'origin', x: 0, y: 0 },
    { name: 'upper', parent: 'shoulder', anchor: 'origin', length: 70 },
    { name: 'lower', parent: 'upper', anchor: 'end', length: 120 },
    { name: 'hand', parent: 'lower', anchor: 'end' },
  ]);

  const targets = [
    { x: 80, y: 60 },
    { x: 150, y: -40 },
    { x: -120, y: 70 },
    { x: 900, y: -600 },
    { x: 1, y: 1 },
  ];

  for (const target of targets) {
    rig.resetToRest();
    rig.solveTwoBoneIK({ upper: 'upper', lower: 'lower', target, pole: { x: 0, y: 120 } });
    const upper = rig.getBone('upper');
    const lower = rig.getBone('lower');
    const upperLength = Math.hypot(upper.end.x - upper.start.x, upper.end.y - upper.start.y);
    const lowerLength = Math.hypot(lower.end.x - lower.start.x, lower.end.y - lower.start.y);
    assertNear(upperLength, 70, 0.001, 'upper arm length');
    assertNear(lowerLength, 120, 0.001, 'forearm length');
    if (![upper.start.x, upper.start.y, upper.end.x, upper.end.y, lower.end.x, lower.end.y].every(Number.isFinite)) {
      throw new Error('Rig2D produced a non-finite transform');
    }
  }

  for (let frame = 0; frame < 1000; frame += 1) {
    rig.resetToRest();
    rig.applyPose({ root: { rotation: 0.08, y: 3 } }, 0.7);
  }
  const root = rig.getBone('root');
  assertNear(root.local.rotation, 0.056, 0.0001, 'rest-reset rotation drift');
  assertNear(root.local.y, 2.1, 0.0001, 'rest-reset translation drift');

  return rig.debugSnapshot();
}

/**
 * Regression for the transient bug static screenshots missed: an arm could jump
 * to the mirror IK solution while moving from crossed rest into a gesture.
 * Every full path is sampled frame-by-frame; a single elbow teleport fails CI.
 */
export function validateMiloMotionContinuity() {
  const actions = ['touchFace', 'openArms', 'celebrate', 'greet', 'explain'] as const;
  const report: Record<string, number> = {};

  for (const action of actions) {
    const character = new DirectedMiloCharacter();
    character.setEmotion('calm');
    character.setMode('speaking');
    character.perform(defaultCue);
    for (let frame = 0; frame < 8; frame += 1) character.update(fixedTicker);

    let snapshot = character.interaction.debugSnapshot();
    let previous = {
      left: snapshot.bones.find((bone) => bone.name === 'upperArmL')!.end,
      right: snapshot.bones.find((bone) => bone.name === 'upperArmR')!.end,
    };
    let maxStep = 0;
    character.interaction.action(action, 0.9);

    for (let frame = 0; frame < 110; frame += 1) {
      character.update(fixedTicker);
      snapshot = character.interaction.debugSnapshot();
      const current = {
        left: snapshot.bones.find((bone) => bone.name === 'upperArmL')!.end,
        right: snapshot.bones.find((bone) => bone.name === 'upperArmR')!.end,
      };
      maxStep = Math.max(maxStep, distance(previous.left, current.left), distance(previous.right, current.right));
      previous = current;
    }

    // Normal spring motion is single-digit pixels/frame at 60 fps. 24px leaves
    // generous room for strong acting but catches a mirrored elbow teleport.
    if (!Number.isFinite(maxStep) || maxStep > 24) {
      throw new Error(`${action}: elbow continuity broke (${maxStep.toFixed(2)} px in one frame)`);
    }
    report[action] = maxStep;
  }

  return report;
}

const defaultCue: PerformanceCue = {
  affect: 'neutral', intensity: 0.5, gesture: 'none', posture: 'neutral', gaze: 'user',
};

type InteractionCase = 'rest' | 'point' | 'reach' | 'touchFace' | 'openArms' | 'celebrate' | 'greet' | 'explain' | 'unreachable';

export async function mountMiloInteractionHarness(
  interaction: InteractionCase,
  frames = 90,
) {
  const harnessWindow = window as unknown as HarnessWindow;
  harnessWindow.__pixiliveRigApp?.destroy(true, { children: true });
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#080808';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = 'rig2d-harness';
  Object.assign(host.style, {
    width: '640px', height: '720px', position: 'relative', overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 42%, #1a1a1a, #080808 62%)',
  });
  document.body.appendChild(host);

  const app = new Application();
  await app.init({ width: 640, height: 720, antialias: true, resolution: 2, autoDensity: true, background: '#080808' });
  harnessWindow.__pixiliveRigApp = app;
  host.appendChild(app.canvas);

  const character = new DirectedMiloCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(320, 315);
  character.view.scale.set(1.28);
  character.setEmotion('calm');
  character.setMode('speaking' as CharacterMode);
  character.perform(defaultCue);

  if (interaction === 'point') character.interaction.pointAt({ x: 150, y: -32 }, 'rightHand');
  if (interaction === 'reach') character.interaction.reach('leftHand', { x: -145, y: 38 }, { hold: true });
  if (interaction === 'touchFace') character.interaction.action('touchFace', 0.9);
  if (interaction === 'openArms') character.interaction.action('openArms', 0.9);
  if (interaction === 'celebrate') character.interaction.action('celebrate', 0.95);
  if (interaction === 'greet') character.interaction.action('greet', 0.92);
  if (interaction === 'explain') character.interaction.action('explain', 0.9);
  if (interaction === 'unreachable') character.interaction.reach('rightHand', { x: 520, y: -330 }, { hold: true });

  for (let frame = 0; frame < frames; frame += 1) character.update(fixedTicker);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
