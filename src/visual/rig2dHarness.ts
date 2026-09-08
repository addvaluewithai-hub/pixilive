import { Application } from 'pixi.js';
import { DirectedMiloCharacter } from '../character/DirectedMiloCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';
import { Rig2D } from '../rig2d';

interface HarnessWindow extends Window {
  __pixiliveRigApp?: Application;
}

const assertNear = (actual: number, expected: number, tolerance: number, label: string) => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected.toFixed(3)}, got ${actual}`);
  }
};

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

const defaultCue: PerformanceCue = {
  affect: 'neutral', intensity: 0.5, gesture: 'none', posture: 'neutral', gaze: 'user',
};

export async function mountMiloInteractionHarness(
  interaction: 'rest' | 'point' | 'reach' | 'touchFace' | 'openArms' | 'unreachable',
  frames = 90,
) {
  const harnessWindow = window as HarnessWindow;
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
  if (interaction === 'touchFace') character.interaction.action('touchFace', 0.82);
  if (interaction === 'openArms') character.interaction.action('openArms', 0.82);
  if (interaction === 'unreachable') character.interaction.reach('rightHand', { x: 520, y: -330 }, { hold: true });

  for (let frame = 0; frame < frames; frame += 1) {
    character.update(app.ticker);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
