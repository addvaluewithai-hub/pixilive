import { Application, Container, Graphics } from 'pixi.js';
import { MiloVisemeCharacter } from '../character/MiloVisemeCharacter';
import type { MouthPose } from '../character/types';

interface HarnessWindow extends Window {
  __pixiliveHarnessApp?: Application;
}

export async function mountMiloVisemeHarness(pose: MouthPose) {
  const harnessWindow = window as HarnessWindow;
  harnessWindow.__pixiliveHarnessApp?.destroy(true, { children: true });

  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#0b0c0e';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = 'viseme-harness';
  Object.assign(host.style, {
    width: '520px',
    height: '520px',
    margin: '0',
    position: 'relative',
    overflow: 'hidden',
    background: '#0b0c0e',
  });
  document.body.appendChild(host);

  const app = new Application();
  await app.init({ width: 520, height: 520, antialias: true, resolution: 2, autoDensity: true, background: '#0b0c0e' });
  harnessWindow.__pixiliveHarnessApp = app;
  host.appendChild(app.canvas);

  const crop = new Container();
  app.stage.addChild(crop);
  const character = new MiloVisemeCharacter();
  crop.addChild(character.view);
  character.view.position.set(260, 250);
  character.view.scale.set(1.55);
  character.setEmotion('calm');
  character.setMouth(pose, true);

  // Cover the body so the artifact is an easy-to-compare face study.
  crop.addChild(new Graphics().rect(0, 390, 520, 130).fill(0x0b0c0e));

  for (let frame = 0; frame < 18; frame += 1) {
    character.update(app.ticker);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
