import { type Container, Graphics, type Ticker } from 'pixi.js';
import { MiloVisemeCharacter } from './MiloVisemeCharacter';
import {
  neutralPerformanceCue,
  normalizePerformanceCue,
  type CharacterMode,
  type PerformanceCue,
} from './performance';
import type { Emotion, MouthPose } from './types';

const C = { ink: 0x0b0c0e };
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

interface MiloFaceLayers {
  head: Container;
  mouth: Graphics;
  browLeft: Graphics;
  browRight: Graphics;
  cheekLeft: Graphics;
  cheekRight: Graphics;
  eyeLeft: { root: Container };
  eyeRight: { root: Container };
}

interface MiloVisemeInternals {
  layers: MiloFaceLayers;
  mouth: Graphics;
  speaking: boolean;
}

/**
 * Milo-specific facial art direction on top of the shared semantic runtime.
 *
 * The base runtime owns lip sync, arms and core motion. This adapter makes
 * semantic affects readable at a glance without leaking Milo face controls into
 * Gemini or the shared CharacterRuntime API.
 */
export class DirectedMiloCharacter {
  readonly view: Container;
  private readonly base = new MiloVisemeCharacter();
  private readonly internals: MiloVisemeInternals;
  private cue: PerformanceCue = { ...neutralPerformanceCue };
  private mode: CharacterMode = 'idle';
  private expressionWeight = 0;

  constructor() {
    this.view = this.base.view;
    this.internals = this.base as unknown as MiloVisemeInternals;
  }

  setEmotion(emotion: Emotion) {
    this.base.setEmotion(emotion);
  }

  setMouth(pose: MouthPose, speaking = true) {
    this.base.setMouth(pose, speaking);
  }

  settleMouth() {
    this.base.settleMouth();
  }

  lookAt(normalizedX: number, normalizedY: number) {
    this.base.lookAt(normalizedX, normalizedY);
  }

  react() {
    this.base.react();
  }

  setMode(mode: CharacterMode) {
    this.mode = mode;
    this.base.setMode(mode);
  }

  perform(cue: PerformanceCue) {
    this.cue = normalizePerformanceCue(cue);
    this.base.perform(this.cue);
  }

  setSpeechEnergy(energy: number) {
    this.base.setSpeechEnergy(energy);
  }

  interruptPerformance() {
    this.base.interruptPerformance();
    this.cue = {
      ...this.cue,
      gesture: 'none',
      intensity: Math.min(this.cue.intensity, 0.45),
    };
  }

  update(ticker: Ticker) {
    this.base.update(ticker);
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    const modeGain = this.mode === 'idle' ? 0.12 : this.mode === 'listening' ? 0.34 : 1;
    this.expressionWeight = damp(this.expressionWeight, this.cue.intensity * modeGain, 7.5, dt);
    this.applyFace();
  }

  private applyFace() {
    const w = this.expressionWeight;
    const layers = this.internals.layers;

    // Listening should look attentive even when no new semantic cue is active.
    if (this.mode === 'listening') {
      layers.eyeLeft.root.scale.y *= 0.985;
      layers.eyeRight.root.scale.y *= 0.985;
      layers.browLeft.y -= 0.6;
      layers.browRight.y -= 0.6;
    }

    switch (this.cue.affect) {
      case 'surprised':
        layers.eyeLeft.root.scale.y *= 1 + 0.16 * w;
        layers.eyeRight.root.scale.y *= 1 + 0.16 * w;
        layers.browLeft.y -= 5.5 * w;
        layers.browRight.y -= 5.5 * w;
        layers.head.y -= 1.5 * w;
        break;

      case 'concerned':
        layers.eyeLeft.root.scale.y *= 1 - 0.055 * w;
        layers.eyeRight.root.scale.y *= 1 - 0.055 * w;
        layers.browLeft.y -= 2.2 * w;
        layers.browRight.y -= 2.2 * w;
        layers.browLeft.rotation += 0.085 * w;
        layers.browRight.rotation -= 0.085 * w;
        layers.head.rotation += 0.012 * w;
        break;

      case 'curious':
        layers.eyeLeft.root.scale.y *= 1 + 0.045 * w;
        layers.eyeRight.root.scale.y *= 1 + 0.045 * w;
        layers.browRight.y -= 4.2 * w;
        layers.head.rotation += 0.018 * w;
        break;

      case 'thoughtful':
        layers.browRight.y -= 2.8 * w;
        layers.browLeft.rotation += 0.025 * w;
        layers.head.rotation += 0.016 * w;
        break;

      case 'enthusiastic':
        layers.eyeLeft.root.scale.y *= 1 + 0.075 * w;
        layers.eyeRight.root.scale.y *= 1 + 0.075 * w;
        layers.browLeft.y -= 3.5 * w;
        layers.browRight.y -= 3.5 * w;
        layers.cheekLeft.alpha += 0.09 * w;
        layers.cheekRight.alpha += 0.09 * w;
        break;

      case 'playful':
        layers.browRight.y -= 3.2 * w;
        layers.browRight.rotation += 0.055 * w;
        layers.cheekLeft.alpha += 0.08 * w;
        layers.cheekRight.alpha += 0.08 * w;
        break;

      case 'warm':
      case 'reassuring':
        layers.eyeLeft.root.scale.y *= 1 - 0.035 * w;
        layers.eyeRight.root.scale.y *= 1 - 0.035 * w;
        layers.cheekLeft.alpha += 0.07 * w;
        layers.cheekRight.alpha += 0.07 * w;
        break;

      case 'neutral':
      default:
        break;
    }

    if (!this.internals.speaking && this.mode !== 'speaking' && w > 0.12) {
      this.drawRestExpression(w);
    }
  }

  private drawRestExpression(weight: number) {
    const mouth = this.internals.mouth;

    if (this.cue.affect === 'surprised') {
      mouth.clear();
      mouth.ellipse(0, 1.5, 5.5 + weight * 3.5, 7 + weight * 4).fill(C.ink);
      return;
    }

    if (this.cue.affect === 'concerned') {
      mouth.clear();
      mouth
        .moveTo(-12, 2)
        .bezierCurveTo(-5, -3.2 - weight, 5, -3.2 - weight, 12, 2)
        .stroke({ width: 3.2, color: C.ink, cap: 'round' });
      return;
    }

    if (this.cue.affect === 'thoughtful' || this.cue.affect === 'curious') {
      mouth.clear();
      mouth
        .moveTo(-11, 1)
        .bezierCurveTo(-4, 3.2, 4, 1.6, 11, -1.5 - weight)
        .stroke({ width: 3.1, color: C.ink, cap: 'round' });
      return;
    }

    if (this.cue.affect === 'playful') {
      mouth.clear();
      mouth
        .moveTo(-13, -0.5)
        .bezierCurveTo(-5, 5.2 + weight, 5, 3.6 + weight, 12, -2)
        .stroke({ width: 3.3, color: C.ink, cap: 'round' });
    }
  }
}
