import { type Container, Graphics, type Ticker } from 'pixi.js';
import { MiloVisemeCharacter } from './MiloVisemeCharacter';
import {
  neutralPerformanceCue,
  normalizePerformanceCue,
  type CharacterAffect,
  type CharacterMode,
  type PerformanceCue,
} from './performance';
import type { Emotion, MouthPose } from './types';

const C = { ink: 0x0b0c0e };
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

interface MiloFaceLayers {
  root: Container;
  body: Container;
  shoulders: Container;
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

interface ExpressionPose {
  eyeL: number;
  eyeR: number;
  browLiftL: number;
  browLiftR: number;
  browTiltL: number;
  browTiltR: number;
  cheek: number;
  headTilt: number;
  headY: number;
  bodyTilt: number;
  bodyY: number;
  shoulderTilt: number;
  shoulderY: number;
}

const pose = (values: Partial<ExpressionPose>): ExpressionPose => ({
  eyeL: 1,
  eyeR: 1,
  browLiftL: 0,
  browLiftR: 0,
  browTiltL: 0,
  browTiltR: 0,
  cheek: 0,
  headTilt: 0,
  headY: 0,
  bodyTilt: 0,
  bodyY: 0,
  shoulderTilt: 0,
  shoulderY: 0,
  ...values,
});

const expressionPoses: Record<CharacterAffect, ExpressionPose> = {
  neutral: pose({}),
  warm: pose({
    eyeL: 0.92, eyeR: 0.92, browLiftL: -1.2, browLiftR: -1.2,
    cheek: 0.11, headTilt: -0.018, bodyTilt: -0.004,
  }),
  curious: pose({
    eyeL: 1.06, eyeR: 1.01, browLiftL: -2.5, browLiftR: -7,
    browTiltL: -0.025, browTiltR: 0.075, headTilt: 0.055, headY: -1.5,
    bodyTilt: 0.009, shoulderTilt: -0.006,
  }),
  enthusiastic: pose({
    eyeL: 1.11, eyeR: 1.11, browLiftL: -5.5, browLiftR: -5.5,
    browTiltL: -0.035, browTiltR: 0.035, cheek: 0.18, headY: -2.2,
    bodyY: -1.4, shoulderY: -1.6,
  }),
  reassuring: pose({
    eyeL: 0.87, eyeR: 0.89, browLiftL: -1.4, browLiftR: -1.7,
    browTiltL: 0.025, browTiltR: -0.025, cheek: 0.12, headTilt: 0.032,
    bodyTilt: -0.008, bodyY: -0.6,
  }),
  concerned: pose({
    eyeL: 0.9, eyeR: 0.93, browLiftL: -3.4, browLiftR: -3.4,
    browTiltL: 0.13, browTiltR: -0.13, headTilt: 0.036, headY: 1,
    bodyTilt: -0.01, shoulderY: 1.2,
  }),
  surprised: pose({
    eyeL: 1.25, eyeR: 1.25, browLiftL: -9, browLiftR: -9,
    browTiltL: -0.02, browTiltR: 0.02, headY: -4, bodyY: 1.5,
    shoulderY: -2.8,
  }),
  thoughtful: pose({
    eyeL: 0.91, eyeR: 0.96, browLiftL: -1.1, browLiftR: -4.4,
    browTiltL: 0.045, browTiltR: 0.015, headTilt: -0.045, headY: 0.6,
    bodyTilt: 0.012, shoulderTilt: 0.007,
  }),
  playful: pose({
    eyeL: 0.94, eyeR: 1.04, browLiftL: -1.8, browLiftR: -6.2,
    browTiltL: -0.015, browTiltR: 0.11, cheek: 0.16, headTilt: -0.045,
    shoulderTilt: 0.008,
  }),
};

/**
 * Milo-specific acting layer on top of the shared semantic runtime.
 * The shared engine deals in meaning; this class owns Milo's visual grammar:
 * asymmetry, facial pose, torso/shoulder participation and subtle follow-through.
 */
export class DirectedMiloCharacter {
  readonly view: Container;
  private readonly base = new MiloVisemeCharacter();
  private readonly internals: MiloVisemeInternals;
  private cue: PerformanceCue = { ...neutralPerformanceCue };
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
    this.expressionAccent = 1;
    this.base.react();
  }

  setMode(mode: CharacterMode) {
    this.mode = mode;
    this.base.setMode(mode);
  }

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
    this.cue = {
      ...this.cue,
      gesture: 'none',
      intensity: Math.min(this.cue.intensity, 0.42),
    };
    this.expressionAccent = Math.min(this.expressionAccent, 0.3);
  }

  update(ticker: Ticker) {
    this.base.update(ticker);
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    this.time += dt;
    this.smoothedSpeech = damp(this.smoothedSpeech, this.speechEnergy, 9.5, dt);
    this.expressionAccent = damp(this.expressionAccent, 0, 4.2, dt);

    const modeGain = this.mode === 'idle' ? 0.22 : this.mode === 'listening' ? 0.56 : this.mode === 'thinking' ? 0.82 : 1;
    const targetWeight = clamp(this.cue.intensity * modeGain + this.expressionAccent * 0.16);
    this.expressionWeight = damp(this.expressionWeight, targetWeight, this.mode === 'speaking' ? 8.5 : 5.8, dt);
    this.applyActing(dt);
  }

  private applyActing(dt: number) {
    const w = this.expressionWeight;
    const layers = this.internals.layers;
    const p = expressionPoses[this.cue.affect];
    const speech = this.smoothedSpeech;

    // Micro-asymmetry keeps a held expression alive without noisy head shaking.
    const slowPhase = this.time * 0.72 + this.cueSerial * 1.37;
    const micro = Math.sin(slowPhase) * 0.5 + Math.sin(slowPhase * 0.43 + 1.8) * 0.5;
    const microBrow = micro * 0.7 * (0.25 + w * 0.5);

    layers.eyeLeft.root.scale.y *= 1 + (p.eyeL - 1) * w;
    layers.eyeRight.root.scale.y *= 1 + (p.eyeR - 1) * w;
    layers.browLeft.y += p.browLiftL * w - microBrow * 0.35;
    layers.browRight.y += p.browLiftR * w + microBrow * 0.35;
    layers.browLeft.rotation += p.browTiltL * w - microBrow * 0.004;
    layers.browRight.rotation += p.browTiltR * w + microBrow * 0.004;
    layers.cheekLeft.alpha += p.cheek * w;
    layers.cheekRight.alpha += p.cheek * w;
    layers.head.rotation += p.headTilt * w;
    layers.head.y += p.headY * w;
    layers.body.rotation += p.bodyTilt * w;
    layers.body.y += p.bodyY * w;
    layers.shoulders.rotation += p.shoulderTilt * w;
    layers.shoulders.y += p.shoulderY * w;

    if (this.mode === 'listening') {
      // Attention is mostly eyes + tiny forward body engagement, not repetitive nodding.
      layers.eyeLeft.root.scale.y *= 0.965;
      layers.eyeRight.root.scale.y *= 0.965;
      layers.browLeft.y -= 0.7;
      layers.browRight.y -= 0.7;
      layers.body.rotation -= 0.004;
      layers.head.y -= 0.7 + Math.sin(this.time * 0.75) * 0.3;
    } else if (this.mode === 'thinking') {
      layers.eyeLeft.root.scale.y *= 0.96;
      layers.eyeRight.root.scale.y *= 0.98;
      layers.shoulders.y += 0.6;
      layers.body.rotation += 0.004;
    } else if (this.mode === 'speaking') {
      // Prosody travels through chest/shoulders before it reaches the head.
      const phrasePulse = speech * (0.55 + 0.45 * Math.sin(this.time * 5.2) ** 2);
      layers.body.y -= phrasePulse * 1.2;
      layers.body.scale.y *= 1 + phrasePulse * 0.0038;
      layers.shoulders.y -= phrasePulse * 0.85;
      layers.shoulders.rotation += Math.sin(this.time * 2.3 + this.cueSerial) * phrasePulse * 0.0028;
      layers.head.y -= phrasePulse * 0.32;
    }

    if (this.expressionAccent > 0.02) {
      const accent = this.expressionAccent * (0.45 + this.cue.intensity * 0.55);
      layers.head.y -= accent * 1.6;
      layers.shoulders.y -= accent * 1.1;
    }

    // A very small breathing offset links the face and torso visually. Base Milo
    // already breathes; this phase offset prevents the upper body feeling rigid.
    const breath = Math.sin(this.time * 1.85 + 0.4) * 0.32;
    layers.shoulders.y += breath;

    if (!this.internals.speaking && this.mode !== 'speaking' && w > 0.1) {
      this.drawRestExpression(w);
    }

    void dt;
  }

  private drawRestExpression(weight: number) {
    const mouth = this.internals.mouth;

    if (this.cue.affect === 'surprised') {
      mouth.clear();
      mouth.ellipse(0, 1.2, 5.4 + weight * 4.1, 7.2 + weight * 4.8).fill(C.ink);
      return;
    }

    if (this.cue.affect === 'concerned') {
      mouth.clear();
      mouth
        .moveTo(-13, 2.8)
        .bezierCurveTo(-5.5, -3.8 - weight * 1.8, 5.5, -3.8 - weight * 1.8, 13, 2.8)
        .stroke({ width: 3.2, color: C.ink, cap: 'round' });
      return;
    }

    if (this.cue.affect === 'thoughtful') {
      mouth.clear();
      mouth
        .moveTo(-10.5, 1)
        .bezierCurveTo(-3.5, 2.5, 4.5, 1.7, 10.5, -1.7 - weight)
        .stroke({ width: 3.05, color: C.ink, cap: 'round' });
      return;
    }

    if (this.cue.affect === 'curious') {
      mouth.clear();
      mouth
        .moveTo(-11.5, 0.6)
        .bezierCurveTo(-4, 3.6, 5, 2.4, 12, -1.4 - weight * 0.7)
        .stroke({ width: 3.15, color: C.ink, cap: 'round' });
      return;
    }

    if (this.cue.affect === 'enthusiastic' || this.cue.affect === 'playful') {
      mouth.clear();
      const asymmetry = this.cue.affect === 'playful' ? 2.2 : 0;
      mouth
        .moveTo(-14, -0.4 + asymmetry * 0.15)
        .bezierCurveTo(-6, 6.3 + weight * 1.8, 6, 5.6 + weight * 1.8, 14, -1.2 - asymmetry)
        .stroke({ width: 3.35, color: C.ink, cap: 'round' });
      return;
    }

    if (this.cue.affect === 'warm' || this.cue.affect === 'reassuring') {
      mouth.clear();
      mouth
        .moveTo(-12.5, 0)
        .bezierCurveTo(-5, 4.6 + weight, 5, 4.6 + weight, 12.5, 0)
        .stroke({ width: 3.1, color: C.ink, cap: 'round' });
    }
  }
}
