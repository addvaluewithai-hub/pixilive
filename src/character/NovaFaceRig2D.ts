import { Container, Graphics } from 'pixi.js';
import type { CharacterAffect, CharacterMode, PerformanceCue } from './performance';
import type { Emotion } from './types';

const C = {
  face: 0x171a36,
  brow: 0xb9a7ff,
  blush: 0xff8fc8,
  mouth: 0x26142e,
  tongue: 0xff7aa9,
};
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type FacePose = {
  eyeL: number;
  eyeR: number;
  browInnerL: number;
  browInnerR: number;
  browOuterL: number;
  browOuterR: number;
  browArchL: number;
  browArchR: number;
  cheek: number;
  headTilt: number;
  headY: number;
  smile: number;
  mouthOpen: number;
  mouthRound: number;
  mouthSkew: number;
};

export interface NovaFaceLayers {
  head: Container;
  mouth: Graphics;
  browLeft: Graphics;
  browRight: Graphics;
  cheekLeft: Graphics;
  cheekRight: Graphics;
  eyeLeft: { root: Container };
  eyeRight: { root: Container };
}

const pose = (values: Partial<FacePose> = {}): FacePose => ({
  eyeL: 1,
  eyeR: 1,
  browInnerL: 0,
  browInnerR: 0,
  browOuterL: 0,
  browOuterR: 0,
  browArchL: -1,
  browArchR: -1,
  cheek: 0,
  headTilt: 0,
  headY: 0,
  smile: 0.18,
  mouthOpen: 0,
  mouthRound: 0,
  mouthSkew: 0,
  ...values,
});

const emotionPoses: Record<Emotion, FacePose> = {
  calm: pose({ smile: 0.18 }),
  happy: pose({
    eyeL: 0.82, eyeR: 0.82,
    browInnerL: -1, browInnerR: -1,
    browOuterL: -3, browOuterR: -3,
    browArchL: -4.4, browArchR: -4.4,
    cheek: 0.28, headTilt: -0.012, smile: 0.9,
  }),
  curious: pose({
    eyeL: 1.08, eyeR: 1.01,
    browInnerL: -1, browInnerR: -7,
    browOuterL: 0, browOuterR: -3,
    browArchL: -2, browArchR: -5.5,
    headTilt: 0.05, smile: 0.28, mouthSkew: 0.12,
  }),
  excited: pose({
    eyeL: 1.08, eyeR: 1.08,
    browInnerL: -7, browInnerR: -7,
    browOuterL: -8, browOuterR: -8,
    browArchL: -8, browArchR: -8,
    cheek: 0.38, headY: -2, smile: 1, mouthOpen: 0.3,
  }),
};

const affectPoses: Record<CharacterAffect, FacePose> = {
  neutral: pose({}),
  warm: pose({
    eyeL: 0.9, eyeR: 0.9,
    browInnerL: -1, browInnerR: -1,
    browOuterL: -2, browOuterR: -2,
    browArchL: -3.5, browArchR: -3.5,
    cheek: 0.18, headTilt: -0.018, smile: 0.58,
  }),
  curious: pose({
    eyeL: 1.1, eyeR: 1.01,
    browInnerL: -1, browInnerR: -7.5,
    browOuterL: 0.5, browOuterR: -3,
    browArchL: -1.5, browArchR: -6,
    headTilt: 0.055, smile: 0.27, mouthSkew: 0.16,
  }),
  enthusiastic: pose({
    eyeL: 1.08, eyeR: 1.08,
    browInnerL: -7.5, browInnerR: -7.5,
    browOuterL: -8.5, browOuterR: -8.5,
    browArchL: -8.5, browArchR: -8.5,
    cheek: 0.4, headY: -2.4, smile: 1, mouthOpen: 0.34,
  }),
  reassuring: pose({
    eyeL: 0.86, eyeR: 0.88,
    browInnerL: -1, browInnerR: -1,
    browOuterL: 0, browOuterR: 0,
    browArchL: -2.5, browArchR: -2.5,
    cheek: 0.18, headTilt: 0.025, smile: 0.48,
  }),
  concerned: pose({
    eyeL: 0.93, eyeR: 0.94,
    browInnerL: -8.5, browInnerR: -8.5,
    browOuterL: 3.5, browOuterR: 3.5,
    browArchL: -1, browArchR: -1,
    headTilt: 0.03, headY: 1.2, smile: -0.55,
  }),
  surprised: pose({
    eyeL: 1.25, eyeR: 1.25,
    browInnerL: -11, browInnerR: -11,
    browOuterL: -11, browOuterR: -11,
    browArchL: -10, browArchR: -10,
    headY: -3, smile: 0, mouthOpen: 0.72, mouthRound: 1,
  }),
  thoughtful: pose({
    eyeL: 0.92, eyeR: 0.99,
    browInnerL: 1, browInnerR: -5,
    browOuterL: 2, browOuterR: -2,
    browArchL: -0.5, browArchR: -4,
    headTilt: -0.045, smile: 0.05, mouthSkew: 0.35,
  }),
  playful: pose({
    eyeL: 0.58, eyeR: 1.03,
    browInnerL: 1, browInnerR: -8,
    browOuterL: 3, browOuterR: -6,
    browArchL: -0.5, browArchR: -6.5,
    cheek: 0.24, headTilt: -0.055, smile: 0.86, mouthSkew: 0.48,
  }),
};

const blendPose = (a: FacePose, b: FacePose, weight: number): FacePose => {
  const t = clamp(weight);
  const result = {} as FacePose;
  for (const key of Object.keys(a) as Array<keyof FacePose>) result[key] = lerp(a[key], b[key], t);
  return result;
};

export class NovaFaceRig2D {
  constructor(private readonly layers: NovaFaceLayers) {}

  apply(input: {
    emotion: Emotion;
    cue: PerformanceCue;
    performanceWeight: number;
    mode: CharacterMode;
    speaking: boolean;
    time: number;
    accent: number;
  }) {
    const manual = emotionPoses[input.emotion];
    const semantic = affectPoses[input.cue.affect];
    const weight = input.cue.affect === 'neutral' ? 0 : clamp(input.performanceWeight);
    let p = blendPose(manual, semantic, weight);

    if (input.mode === 'listening') {
      p = { ...p, eyeL: p.eyeL * 0.98, eyeR: p.eyeR * 0.98, headY: p.headY - 0.5 };
    } else if (input.mode === 'thinking') {
      p = { ...p, eyeL: p.eyeL * 0.95, mouthSkew: p.mouthSkew + 0.05 };
    }

    const micro = Math.sin(input.time * 0.68 + 0.4) * 0.5 + Math.sin(input.time * 0.29 + 2.1) * 0.5;
    const accent = clamp(input.accent);
    p = {
      ...p,
      browOuterL: p.browOuterL - micro * 0.24 - accent * 0.55,
      browOuterR: p.browOuterR + micro * 0.2 - accent * 0.55,
      headY: p.headY - accent * 0.8,
    };

    this.layers.eyeLeft.root.scale.y *= Math.max(0.48, p.eyeL);
    this.layers.eyeRight.root.scale.y *= Math.max(0.48, p.eyeR);
    this.layers.head.rotation += p.headTilt;
    this.layers.head.y += p.headY;
    this.layers.cheekLeft.alpha += p.cheek;
    this.layers.cheekRight.alpha += p.cheek;
    this.drawBrows(p);
    if (!input.speaking) this.drawRestMouth(p);
  }

  private drawBrows(p: FacePose) {
    this.layers.browLeft.rotation = 0;
    this.layers.browRight.rotation = 0;
    this.layers.browLeft.y = -42;
    this.layers.browRight.y = -42;

    this.layers.browLeft.clear()
      .moveTo(-18, p.browOuterL)
      .bezierCurveTo(-8, p.browArchL, 8, p.browArchL, 18, p.browInnerL)
      .stroke({ width: 5.2, color: C.brow, cap: 'round' });
    this.layers.browRight.clear()
      .moveTo(-18, p.browInnerR)
      .bezierCurveTo(-8, p.browArchR, 8, p.browArchR, 18, p.browOuterR)
      .stroke({ width: 5.2, color: C.brow, cap: 'round' });
  }

  private drawRestMouth(p: FacePose) {
    const g = this.layers.mouth;
    g.clear();
    const skew = p.mouthSkew * 5;
    const width = 28 + Math.abs(p.smile) * 11;
    const y = -p.smile * 2;

    if (p.mouthOpen > 0.16 || p.mouthRound > 0.3) {
      const rx = p.mouthRound > 0.45 ? 13 : width * 0.48;
      const ry = 4 + p.mouthOpen * 18;
      g.moveTo(-rx + skew, y)
        .bezierCurveTo(-rx * 0.8 + skew, y - ry, rx * 0.8 + skew, y - ry, rx + skew, y)
        .bezierCurveTo(rx * 0.8 + skew, y + ry, -rx * 0.8 + skew, y + ry, -rx + skew, y)
        .closePath()
        .fill(C.mouth);
      if (p.mouthRound < 0.7 && p.smile > 0.4) {
        g.ellipse(skew, y + ry * 0.42, rx * 0.48, Math.max(2, ry * 0.3)).fill({ color: C.tongue, alpha: 0.9 });
      }
      return;
    }

    const curve = p.smile * -9;
    g.moveTo(-width * 0.5 + skew, y)
      .bezierCurveTo(-width * 0.2 + skew, y + curve, width * 0.2 + skew, y + curve, width * 0.5 + skew, y)
      .stroke({ width: 4.2, color: C.blush, alpha: 0.94, cap: 'round' });
  }
}
