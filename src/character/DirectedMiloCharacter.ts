import { type Container, Graphics, type Ticker } from 'pixi.js';
import { MiloFaceRig2D, type MiloFaceLayers } from './MiloFaceRig2D';
import { MiloVisemeCharacter } from './MiloVisemeCharacter';
import {
  neutralPerformanceCue,
  normalizePerformanceCue,
  type CharacterAffect,
  type CharacterMode,
  type PerformanceCue,
} from './performance';
import type { Emotion, MouthPose } from './types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

interface MiloLayers extends MiloFaceLayers {
  root: Container;
  body: Container;
  shoulders: Container;
}

interface MiloVisemeInternals {
  layers: MiloLayers;
  mouth: Graphics;
  speaking: boolean;
}

type BodyPose = {
  bodyTilt: number;
  bodyY: number;
  shoulderTilt: number;
  shoulderY: number;
};

const bodyPose = (values: Partial<BodyPose> = {}): BodyPose => ({
  bodyTilt: 0,
  bodyY: 0,
  shoulderTilt: 0,
  shoulderY: 0,
  ...values,
});

const bodyPoses: Record<CharacterAffect, BodyPose> = {
  neutral: bodyPose({}),
  warm: bodyPose({ bodyTilt: -0.004, bodyY: -0.3 }),
  curious: bodyPose({ bodyTilt: 0.008, shoulderTilt: -0.005 }),
  enthusiastic: bodyPose({ bodyY: -1.5, shoulderY: -1.7 }),
  reassuring: bodyPose({ bodyTilt: -0.007, bodyY: -0.7, shoulderY: -0.4 }),
  concerned: bodyPose({ bodyTilt: -0.009, shoulderY: 1.1 }),
  surprised: bodyPose({ bodyY: 1.3, shoulderY: -2.6 }),
  thoughtful: bodyPose({ bodyTilt: 0.01, shoulderTilt: 0.006 }),
  playful: bodyPose({ bodyTilt: -0.004, shoulderTilt: 0.007 }),
};

/** Character-specific acting adapter for Milo. */
export class DirectedMiloCharacter {
  readonly view: Container;
  private readonly base = new MiloVisemeCharacter();
  readonly interaction = this.base.interaction;
  private readonly internals: MiloVisemeInternals;
  private readonly face: MiloFaceRig2D;
  private cue: PerformanceCue = { ...neutralPerformanceCue };
  private emotion: Emotion = 'calm';
  private mode: CharacterMode = 'idle';
  private expressionWeight = 0;
  private expressionAccent = 0;
  private speechEnergy = 0;
  private smoothedSpeech = 0;
  private time = 0;
  private cueSerial = 0;

  constructor() {
    this.view = this.base.view;
    this.internals = this.base as unknown as MiloVisemeInternals;
    // MiloVisemeCharacter hides MiloCharacter's original mouth and adds its own
    // richer viseme mouth. Face acting must draw into that visible object.
    this.face = new MiloFaceRig2D({
      ...this.internals.layers,
      mouth: this.internals.mouth,
    });
  }

  setEmotion(emotion: Emotion) {
    this.emotion = emotion;
    this.base.setEmotion(emotion);
    this.expressionAccent = Math.max(this.expressionAccent, 0.72);
  }

  setMouth(pose: MouthPose, speaking = true) { this.base.setMouth(pose, speaking); }
  settleMouth() { this.base.settleMouth(); }
  lookAt(normalizedX: number, normalizedY: number) { this.base.lookAt(normalizedX, normalizedY); }
  react() { this.expressionAccent = 1; this.base.react(); }
  setMode(mode: CharacterMode) { this.mode = mode; this.base.setMode(mode); }

  perform(cue: PerformanceCue) {
    const next = normalizePerformanceCue(cue);
    const changed = next.affect !== this.cue.affect || next.gesture !== this.cue.gesture;
    this.cue = next;
    if (changed) {
      this.expressionAccent = 1;
      this.cueSerial += 1;
    }
    this.base.perform(this.cue);
  }

  setSpeechEnergy(energy: number) {
    this.speechEnergy = clamp(energy);
    this.base.setSpeechEnergy(energy);
  }

  interruptPerformance() {
    this.base.interruptPerformance();
    this.cue = { ...this.cue, gesture: 'none', intensity: Math.min(this.cue.intensity, 0.42) };
    this.expressionAccent = Math.min(this.expressionAccent, 0.3);
  }

  update(ticker: Ticker) {
    this.base.update(ticker);
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    this.time += dt;
    this.smoothedSpeech = damp(this.smoothedSpeech, this.speechEnergy, 9.5, dt);
    this.expressionAccent = damp(this.expressionAccent, 0, 4.2, dt);

    const hasPerformanceExpression = this.cue.affect !== 'neutral';
    const modeGain = this.mode === 'idle' ? 0.3 : this.mode === 'listening' ? 0.72 : this.mode === 'thinking' ? 0.86 : 1;
    const targetWeight = hasPerformanceExpression
      ? clamp(this.cue.intensity * modeGain + this.expressionAccent * 0.14)
      : 0;
    this.expressionWeight = damp(this.expressionWeight, targetWeight, this.mode === 'speaking' ? 8.5 : 6.2, dt);

    this.applyBodyActing();
    this.face.apply({
      emotion: this.emotion,
      cue: this.cue,
      performanceWeight: this.expressionWeight,
      mode: this.mode,
      speaking: this.internals.speaking,
      time: this.time,
      accent: this.expressionAccent,
    });
  }

  private applyBodyActing() {
    const layers = this.internals.layers;
    const w = this.expressionWeight;
    const p = bodyPoses[this.cue.affect];
    const speech = this.smoothedSpeech;

    layers.body.rotation = 0;
    layers.shoulders.y = 7;
    layers.body.rotation += p.bodyTilt * w;
    layers.body.y += p.bodyY * w;
    layers.shoulders.rotation += p.shoulderTilt * w;
    layers.shoulders.y += p.shoulderY * w;

    if (this.mode === 'listening') {
      layers.body.rotation -= 0.0035;
      layers.shoulders.y -= 0.35;
    } else if (this.mode === 'thinking') {
      layers.body.rotation += 0.0035;
      layers.shoulders.y += 0.55;
    } else if (this.mode === 'speaking') {
      const phrasePulse = speech * (0.55 + 0.45 * Math.sin(this.time * 5.2) ** 2);
      layers.body.y -= phrasePulse * 1.15;
      layers.body.scale.y *= 1 + phrasePulse * 0.0036;
      layers.shoulders.y -= phrasePulse * 0.8;
      layers.shoulders.rotation += Math.sin(this.time * 2.3 + this.cueSerial) * phrasePulse * 0.0026;
    }

    if (this.expressionAccent > 0.02) {
      const accent = this.expressionAccent * (0.42 + this.cue.intensity * 0.5);
      layers.shoulders.y -= accent * 0.9;
    }

    layers.shoulders.y += Math.sin(this.time * 1.85 + 0.4) * 0.28;
  }
}
