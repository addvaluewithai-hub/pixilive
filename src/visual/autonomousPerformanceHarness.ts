import { Application } from 'pixi.js';
import type { SpeechDynamics } from '../audio/SpeechProsodyAnalyzer';
import { DirectedMiloCharacter } from '../character/DirectedMiloCharacter';
import { LocalPerformanceEngine } from '../character/LocalPerformanceEngine';

interface HarnessWindow extends Window {
  __pixiliveAutonomousApp?: Application;
}

export interface AutonomousHarnessInput {
  transcript: string;
  dynamics: SpeechDynamics;
  frames?: number;
}

/** Visual proof that ordinary acting works with no Gemini function call. */
export async function mountMiloAutonomousPerformanceHarness(input: AutonomousHarnessInput) {
  const harnessWindow = window as HarnessWindow;
  harnessWindow.__pixiliveAutonomousApp?.destroy(true, { children: true });

  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#080808';
  document.body.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.id = 'autonomous-performance-harness';
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
  harnessWindow.__pixiliveAutonomousApp = app;
  host.appendChild(app.canvas);

  const character = new DirectedMiloCharacter();
  app.stage.addChild(character.view);
  character.view.position.set(320, 315);
  character.view.scale.set(1.28);
  character.setEmotion('calm');
  character.lookAt(0, 0);
  character.setMode('speaking');

  const brain = new LocalPerformanceEngine({
    onCue: (cue) => character.perform(cue),
  });
  brain.pushOutputTranscript(input.transcript);
  brain.beginSpeech();
  character.setSpeechEnergy(input.dynamics.energy);

  const frames = input.frames ?? 82;
  for (let frame = 0; frame < frames; frame += 1) {
    // Repeated phrase-level dynamics simulate playback callbacks. Give every
    // few frames a stronger onset so semantic + prosody fusion can gesture.
    if (frame % 7 === 0) {
      brain.updateSpeech({
        ...input.dynamics,
        onset: frame === 21 || frame === 49 ? Math.max(0.68, input.dynamics.onset) : input.dynamics.onset,
      }, 0.03);
    }
    character.update(app.ticker);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
