import { Application, type Ticker } from 'pixi.js';
import { DirectedNovaCharacter } from '../character/DirectedNovaCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';
import type { Emotion, MouthPose } from '../character/types';

interface HarnessWindow extends Window {
  __pixiliveNovaQaApp?: Application;
}

const fixedTicker = { deltaMS: 1000 / 60 } as Ticker;

async function createHost(id: string, width = 640, height = 500) {
  const harnessWindow = window as HarnessWindow;
  harnessWindow.__pixiliveNovaQaApp?.destroy(true, { children: true });
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#090b22';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = id;
  Object.assign(host.style, {
    width: `${width}px`, height: `${height}px`, position: 'relative', overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 46%, #222654, #090b22 70%)',
  });
  document.body.appendChild(host);

  const app = new Application();
  await app.init({ width, height, antialias: true, resolution: 2, autoDensity: true, background: '#090b22' });
  harnessWindow.__pixiliveNovaQaApp = app;
  host.appendChild(app.canvas);
  return { host, app };
}

export async function mountNovaFaceHarness(input: {
  emotion?: Emotion;
  cue?: PerformanceCue;
  mode?: CharacterMode;
  frames?: number;
}) {
  const { app } = await createHost('nova-face-harness', 640, 500);
  const character = new DirectedNovaCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(320, 250);
  character.view.scale.set(1.85);
  character.setEmotion(input.emotion ?? 'calm');
  character.lookAt(0, 0);
  character.setMode(input.mode ?? 'idle');
  if (input.cue) character.perform(input.cue);
  character.setSpeechEnergy(0);
  character.settleMouth();

  for (let frame = 0; frame < (input.frames ?? 64); frame += 1) character.update(fixedTicker);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function mountNovaMouthTransitionHarness(input: {
  frames: number;
  pose: MouthPose;
}) {
  const { app } = await createHost('nova-mouth-harness', 640, 500);
  const character = new DirectedNovaCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(320, 250);
  character.view.scale.set(1.85);
  character.setEmotion('calm');
  character.lookAt(0, 0);
  character.setMode('speaking');
  character.settleMouth();

  for (let frame = 0; frame < 18; frame += 1) character.update(fixedTicker);
  character.setMouth(input.pose, true);
  for (let frame = 0; frame < input.frames; frame += 1) character.update(fixedTicker);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
