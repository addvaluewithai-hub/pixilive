import { Application, type Ticker } from 'pixi.js';
import { DirectedNovaCharacter } from '../character/DirectedNovaCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';

interface HarnessWindow extends Window {
  __pixiliveNovaPerformanceApp?: Application;
}

const fixedTicker = { deltaMS: 1000 / 60 } as Ticker;

export async function mountNovaPerformanceHarness(cue: PerformanceCue, mode: CharacterMode = 'speaking', frames = 58) {
  const harnessWindow = window as HarnessWindow;
  harnessWindow.__pixiliveNovaPerformanceApp?.destroy(true, { children: true });

  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#0a0d27';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = 'nova-performance-harness';
  Object.assign(host.style, {
    width: '640px', height: '720px', margin: '0', position: 'relative', overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 42%, #222654, #090b22 68%)',
  });
  document.body.appendChild(host);

  const app = new Application();
  await app.init({ width: 640, height: 720, antialias: true, resolution: 2, autoDensity: true, background: '#090b22' });
  harnessWindow.__pixiliveNovaPerformanceApp = app;
  host.appendChild(app.canvas);

  const character = new DirectedNovaCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(320, 340);
  character.view.scale.set(1.35);
  character.setEmotion('calm');
  character.lookAt(0, 0);
  character.setMode(mode);
  character.perform(cue);
  character.setSpeechEnergy(mode === 'speaking' ? 0.42 : 0);

  for (let frame = 0; frame < frames; frame += 1) character.update(fixedTicker);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
