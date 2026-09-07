import { Application } from 'pixi.js';
import { DirectedMiloCharacter } from '../character/DirectedMiloCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';

interface HarnessWindow extends Window {
  __pixilivePerformanceApp?: Application;
}

export async function mountMiloPerformanceHarness(cue: PerformanceCue, mode: CharacterMode = 'speaking', frames = 58) {
  const harnessWindow = window as HarnessWindow;
  harnessWindow.__pixilivePerformanceApp?.destroy(true, { children: true });

  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#080808';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = 'performance-harness';
  Object.assign(host.style, {
    width: '640px',
    height: '720px',
    margin: '0',
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 42%, #1a1a1a, #080808 62%)',
  });
  document.body.appendChild(host);

  const app = new Application();
  await app.init({ width: 640, height: 720, antialias: true, resolution: 2, autoDensity: true, background: '#080808' });
  harnessWindow.__pixilivePerformanceApp = app;
  host.appendChild(app.canvas);

  const character = new DirectedMiloCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(320, 315);
  character.view.scale.set(1.28);
  character.setEmotion('calm');
  character.lookAt(0, 0);
  character.setMode(mode);
  character.perform(cue);
  character.setSpeechEnergy(mode === 'speaking' ? 0.42 : 0);

  for (let frame = 0; frame < frames; frame += 1) {
    character.update(app.ticker);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
