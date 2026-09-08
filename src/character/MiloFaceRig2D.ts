import { Container, Graphics } from 'pixi.js';
import type { CharacterAffect, CharacterMode, PerformanceCue } from './performance';
import type { Emotion } from './types';

const C = { paper: 0xf7f5ef, ink: 0x0b0c0e };
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type FacePose = {
  eyeL: number;
  eyeR: number;
  upperLidL: number;
  upperLidR: number;
  lowerLidL: number;
  lowerLidR: number;
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

export interface MiloFaceLayers {
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
  upperLidL: 0,
  upperLidR: 0,
  lowerLidL: 0,
  lowerLidR: 0,
  browInnerL: 0,
  browInnerR: 0,
  browOuterL: 0,
  browOuterR: 0,
  browArchL: -2.8,
  browArchR: -2.8,
  cheek: 0,
  headTilt: 0,
  headY: 0,
  smile: 0.16,
  mouthOpen: 0,
  mouthRound: 0,
  mouthSkew: 0,
  ...values,
});

const emotionPoses: Record<Emotion, FacePose> = {
  calm: pose({ smile: 0.16 }),
  happy: pose({
    eyeL: 0.79, eyeR: 0.79,
    browInnerL: -1.2, browInnerR: -1.2,
    browOuterL: -3.3, browOuterR: -3.3,
    browArchL: -5.2, browArchR: -5.2,
    cheek: 0.34,
    headTilt: -0.012,
    headY: -1.2,
    smile: 1,
  }),
  curious: pose({
    eyeL: 1.08, eyeR: 1.01,
    browInnerL: -1.2, browInnerR: -6.5,
    browOuterL: -0.4, browOuterR: -3.2,
    browArchL: -3.2, browArchR: -5.8,
    headTilt: 0.052,
    headY: -1.3,
    smile: 0.3,
    mouthSkew: 0.14,
  }),
  excited: pose({
    eyeL: 1.16, eyeR: 1.16,
    browInnerL: -6.3, browInnerR: -6.3,
    browOuterL: -8, browOuterR: -8,
    browArchL: -8, browArchR: -8,
    cheek: 0.34,
    headY: -2.8,
    smile: 0.96,
    mouthOpen: 0.28,
  }),
};

const affectPoses: Record<CharacterAffect, FacePose> = {
  neutral: pose({}),
  warm: pose({
    eyeL: 0.91, eyeR: 0.91,
    browInnerL: -0.5, browInnerR: -0.5,
    browOuterL: -1.8, browOuterR: -1.8,
    browArchL: -3.8, browArchR: -3.8,
    cheek: 0.19,
    headTilt: -0.016,
    smile: 0.58,
  }),
  curious: pose({
    eyeL: 1.09, eyeR: 1.01,
    browInnerL: -1.2, browInnerR: -7,
    browOuterL: -0.4, browOuterR: -3.5,
    browArchL: -3.1, browArchR: -6,
    headTilt: 0.056,
    headY: -1.6,
    smile: 0.28,
    mouthSkew: 0.16,
  }),
  enthusiastic: pose({
    eyeL: 1.18, eyeR: 1.18,
    browInnerL: -6.5, browInnerR: -6.5,
    browOuterL: -8.2, browOuterR: -8.2,
    browArchL: -8.2, browArchR: -8.2,
    cheek: 0.34,
    headY: -3,
    smile: 0.98,
    mouthOpen: 0.3,
  }),
  reassuring: pose({
    eyeL: 0.86, eyeR: 0.88,
    upperLidL: 0.045, upperLidR: 0.035,
    browInnerL: -0.8, browInnerR: -0.8,
    browOuterL: -0.4, browOuterR: -0.4,
    browArchL: -3, browArchR: -3,
    cheek: 0.2,
    headTilt: 0.027,
    headY: 0.3,
    smile: 0.46,
  }),
  concerned: pose({
    eyeL: 0.92, eyeR: 0.94,
    upperLidL: 0.07, upperLidR: 0.06,
    lowerLidL: 0.035, lowerLidR: 0.035,
    browInnerL: -8.5, browInnerR: -8.5,
    browOuterL: 2.4, browOuterR: 2.4,
    browArchL: -2, browArchR: -2,
    headTilt: 0.034,
    headY: 1.2,
    smile: -0.62,
  }),
  surprised: pose({
    eyeL: 1.3, eyeR: 1.3,
    browInnerL: -10, browInnerR: -10,
    browOuterL: -10, browOuterR: -10,
    browArchL: -9.5, browArchR: -9.5,
    headY: -4.2,
    smile: 0,
    mouthOpen: 0.78,
    mouthRound: 1,
  }),
  thoughtful: pose({
    eyeL: 0.9, eyeR: 0.97,
    upperLidL: 0.085, upperLidR: 0.025,
    browInnerL: -0.8, browInnerR: -5.3,
    browOuterL: 0.6, browOuterR: -1.8,
    browArchL: -2.5, browArchR: -4.6,
    headTilt: -0.043,
    headY: 0.7,
    smile: 0.02,
    mouthSkew: 0.34,
  }),
  playful: pose({
    eyeL: 0.82, eyeR: 1.04,
    upperLidL: 0.12,
    browInnerL: -0.5, browInnerR: -7.3,
    browOuterL: 1.6, browOuterR: -5.5,
    browArchL: -1.8, browArchR: -6.2,
    cheek: 0.23,
    headTilt: -0.046,
    smile: 0.78,
    mouthSkew: 0.38,
  }),
};

const blendPose = (a: FacePose, b: FacePose, weight: number): FacePose => {
  const t = clamp(weight);
  const result = {} as FacePose;
  for (const key of Object.keys(a) as Array<keyof FacePose>) result[key] = lerp(a[key], b[key], t);
  return result;
};

/** Expressive code-first facial rig for Milo. */
export class MiloFaceRig2D {
  private readonly upperLidLeft = new Graphics();
  private readonly upperLidRight = new Graphics();
  private readonly lowerLidLeft = new Graphics();
  private readonly lowerLidRight = new Graphics();
  private readonly cheekAccentLeft = new Graphics();
  private readonly cheekAccentRight = new Graphics();

  constructor(private readonly layers: MiloFaceLayers) {
    this.layers.head.addChild(
      this.upperLidLeft,
      this.upperLidRight,
      this.lowerLidLeft,
      this.lowerLidRight,
      this.cheekAccentLeft,
      this.cheekAccentRight,
    );
  }

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
    const performance = affectPoses[input.cue.affect];
    const performanceWeight = input.cue.affect === 'neutral' ? 0 : clamp(input.performanceWeight);
    let p = blendPose(manual, performance, performanceWeight);

    if (input.mode === 'listening') {
      p = { ...p, eyeL: p.eyeL * 0.985, eyeR: p.eyeR * 0.985, headY: p.headY - 0.55 };
    } else if (input.mode === 'thinking') {
      p = { ...p, eyeL: p.eyeL * 0.97, upperLidL: p.upperLidL + 0.02, mouthSkew: p.mouthSkew + 0.05 };
    }

    const micro = Math.sin(input.time * 0.72 + 0.8) * 0.5 + Math.sin(input.time * 0.31 + 2.2) * 0.5;
    const accent = clamp(input.accent);
    p = {
      ...p,
      browOuterL: p.browOuterL - micro * 0.3 - accent * 0.7,
      browOuterR: p.browOuterR + micro * 0.24 - accent * 0.7,
      eyeL: p.eyeL * (1 + accent * 0.035),
      eyeR: p.eyeR * (1 + accent * 0.035),
      headY: p.headY - accent,
    };

    this.layers.eyeLeft.root.scale.y *= Math.max(0.46, p.eyeL);
    this.layers.eyeRight.root.scale.y *= Math.max(0.46, p.eyeR);
    this.layers.head.rotation += p.headTilt;
    this.layers.head.y += p.headY;
    this.layers.cheekLeft.alpha += p.cheek;
    this.layers.cheekRight.alpha += p.cheek;

    this.drawBrows(p);
    this.drawLids(p);
    this.drawCheekAccents(p);
    if (!input.speaking) this.drawRestMouth(p);
  }

  private drawBrows(p: FacePose) {
    this.layers.browLeft.rotation = 0;
    this.layers.browRight.rotation = 0;
    this.layers.browLeft.y = -31;
    this.layers.browRight.y = -31;

    this.layers.browLeft.clear()
      .moveTo(-16, p.browOuterL)
      .bezierCurveTo(-7, p.browArchL, 7, p.browArchL, 16, p.browInnerL)
      .stroke({ width: 4, color: C.ink, cap: 'round' });

    this.layers.browRight.clear()
      .moveTo(-16, p.browInnerR)
      .bezierCurveTo(-7, p.browArchR, 7, p.browArchR, 16, p.browOuterR)
      .stroke({ width: 4, color: C.ink, cap: 'round' });
  }

  private drawLids(p: FacePose) {
    this.drawEyeLid(this.upperLidLeft, -33, -4, p.upperLidL, true);
    this.drawEyeLid(this.upperLidRight, 34, -4, p.upperLidR, true);
    this.drawEyeLid(this.lowerLidLeft, -33, -4, p.lowerLidL, false);
    this.drawEyeLid(this.lowerLidRight, 34, -4, p.lowerLidR, false);
  }

  private drawEyeLid(graphics: Graphics, cx: number, cy: number, amount: number, upper: boolean) {
    graphics.clear();
    const a = clamp(amount, 0, 0.5);
    if (a < 0.025) return;
    const rx = 12;
    const ry = 17;

    if (upper) {
      const y = cy - ry + a * ry * 1.7;
      graphics
        .moveTo(cx - rx - 2, cy - ry - 4)
        .lineTo(cx + rx + 2, cy - ry - 4)
        .lineTo(cx + rx + 2, y)
        .bezierCurveTo(cx + rx * 0.42, y + 2.3, cx - rx * 0.42, y + 2.3, cx - rx - 2, y)
        .closePath()
        .fill(C.paper);
      if (a > 0.065) {
        graphics
          .moveTo(cx - rx * 0.95, y)
          .bezierCurveTo(cx - rx * 0.4, y + 1.7, cx + rx * 0.4, y + 1.7, cx + rx * 0.95, y)
          .stroke({ width: 1.2, color: C.ink, alpha: 0.45, cap: 'round' });
      }
      return;
    }

    const y = cy + ry - a * ry * 1.35;
    graphics
      .moveTo(cx - rx - 2, cy + ry + 4)
      .lineTo(cx + rx + 2, cy + ry + 4)
      .lineTo(cx + rx + 2, y)
      .bezierCurveTo(cx + rx * 0.42, y - 1.6, cx - rx * 0.42, y - 1.6, cx - rx - 2, y)
      .closePath()
      .fill(C.paper);
    if (a > 0.045) {
      graphics
        .moveTo(cx - rx * 0.82, y)
        .bezierCurveTo(cx - rx * 0.32, y - 1.2, cx + rx * 0.32, y - 1.2, cx + rx * 0.82, y)
        .stroke({ width: 1, color: C.ink, alpha: 0.28, cap: 'round' });
    }
  }

  private drawCheekAccents(p: FacePose) {
    this.cheekAccentLeft.clear();
    this.cheekAccentRight.clear();
    if (p.cheek < 0.14) return;
    const alpha = Math.min(0.5, 0.14 + p.cheek * 0.75);
    this.cheekAccentLeft
      .moveTo(-65, 28).bezierCurveTo(-61, 26, -57, 25.5, -53, 26.5)
      .stroke({ width: 1.5, color: C.ink, alpha, cap: 'round' });
    this.cheekAccentRight
      .moveTo(53, 26.5).bezierCurveTo(57, 25.5, 61, 26, 65, 28)
      .stroke({ width: 1.5, color: C.ink, alpha, cap: 'round' });
  }

  private drawRestMouth(p: FacePose) {
    const mouth = this.layers.mouth;
    mouth.clear();

    if (p.mouthOpen > 0.18) {
      const halfWidth = 8 + Math.max(0, p.smile) * 7 + (1 - p.mouthRound) * 3;
      const halfHeight = 4 + p.mouthOpen * 8;
      mouth
        .moveTo(-halfWidth, 0)
        .bezierCurveTo(-halfWidth * 0.6, -halfHeight, halfWidth * 0.6, -halfHeight, halfWidth, 0)
        .bezierCurveTo(halfWidth * 0.6, halfHeight, -halfWidth * 0.6, halfHeight, -halfWidth, 0)
        .closePath()
        .fill(C.ink);
      if (p.smile > 0.35 && p.mouthRound < 0.7) {
        mouth
          .moveTo(-halfWidth * 0.52, -halfHeight * 0.35)
          .bezierCurveTo(-halfWidth * 0.18, -halfHeight * 0.5, halfWidth * 0.18, -halfHeight * 0.5, halfWidth * 0.52, -halfHeight * 0.35)
          .stroke({ width: 1.8, color: C.paper, alpha: 0.9, cap: 'round' });
      }
      return;
    }

    const halfWidth = 12.5 + Math.abs(p.smile) * 3.5;
    const centerY = p.smile * 6.4;
    const skew = p.mouthSkew * 3.2;
    mouth
      .moveTo(-halfWidth, skew * 0.35)
      .bezierCurveTo(-halfWidth * 0.44, centerY + skew, halfWidth * 0.42, centerY - skew * 0.45, halfWidth, -skew * 0.35)
      .stroke({ width: 3.25, color: C.ink, cap: 'round' });
  }
}
