import { Application, type Ticker } from 'pixi.js';
import { DirectedMiloCharacter } from '../character/DirectedMiloCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';
import type { Emotion } from '../character/types';

interface HarnessWindow extends Window {
  __pixiliveFaceApp?: Application;
}

const fixedTicker = { deltaMS: 1000 / 60 } as Ticker;

export interface FaceHarnessInput {
  emotion?: Emotion;
  cue?: PerformanceCue;
  mode?: CharacterMode;
  frames?: number;
}

export async function mountMiloFaceHarness(input: FaceHarnessInput = {}) {
  const harnessWindow = window as HarnessWindow;
  harnessWindow.__pixiliveFaceApp?.destroy(true, { children: true });

  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#080808';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = 'face-harness';
  Object.assign(host.style, {
    width: '420px',
    height: '360px',
    margin: '0',
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 40%, #1b1b1b, #080808 66%)',
  });
  document.body.appendChild(host);

  const app = new Application();
  await app.init({ width: 420, height: 360, antialias: true, resolution: 2, autoDensity: true, background: '#080808' });
  harnessWindow.__pixiliveFaceApp = app;
  host.appendChild(app.canvas);

  const character = new DirectedMiloCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(210, 190);
  character.view.scale.set(1.72);
  character.setEmotion(input.emotion ?? 'calm');
  character.lookAt(0, 0);
  character.setMode(input.mode ?? 'idle');
  if (input.cue) character.perform(input.cue);

  const frames = input.frames ?? 58;
  for (let frame = 0; frame < frames; frame += 1) character.update(fixedTicker);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
