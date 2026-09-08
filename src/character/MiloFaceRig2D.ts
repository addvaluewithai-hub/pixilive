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
    eyeL: 0.86, eyeR: 0.86,
    upperLidL: 0.16, upperLidR: 0.16,
    lowerLidL: 0.08, lowerLidR: 0.08,
    browOuterL: -1.8, browOuterR: -1.8,
    browArchL: -3.6, browArchR: -3.6,
    cheek: 0.26,
    headTilt: -0.014,
    headY: -1,
    smile: 0.9,
  }),
  curious: pose({
    eyeL: 1.06, eyeR: 1.01,
    upperLidL: 0.01, upperLidR: 0.05,
    browInnerL: -1.5, browInnerR: -5.8,
    browOuterL: -0.8, browOuterR: -3.4,
    browArchL: -3.2, browArchR: -5,
    headTilt: 0.05,
    headY: -1.2,
    smile: 0.28,
    mouthSkew: 0.12,
  }),
  excited: pose({
    eyeL: 1.14, eyeR: 1.14,
    browInnerL: -5.5, browInnerR: -5.5,
    browOuterL: -6.6, browOuterR: -6.6,
    browArchL: -6.8, browArchR: -6.8,
    cheek: 0.3,
    headY: -2.6,
    smile: 0.92,
    mouthOpen: 0.16,
  }),
};

const affectPoses: Record<CharacterAffect, FacePose> = {
  neutral: pose({}),
  warm: pose({
    eyeL: 0.91, eyeR: 0.91,
    upperLidL: 0.1, upperLidR: 0.1,
    lowerLidL: 0.04, lowerLidR: 0.04,
    browOuterL: -1.2, browOuterR: -1.2,
    browArchL: -3.4, browArchR: -3.4,
    cheek: 0.16,
    headTilt: -0.018,
    smile: 0.55,
  }),
  curious: pose({
    eyeL: 1.08, eyeR: 1.01,
    upperLidL: 0, upperLidR: 0.05,
    browInnerL: -1.5, browInnerR: -6.5,
    browOuterL: -0.8, browOuterR: -3.5,
    browArchL: -3.1, browArchR: -5.4,
    headTilt: 0.055,
    headY: -1.5,
    smile: 0.26,
    mouthSkew: 0.14,
  }),
  enthusiastic: pose({
    eyeL: 1.16, eyeR: 1.16,
    browInnerL: -5.8, browInnerR: -5.8,
    browOuterL: -7.2, browOuterR: -7.2,
    browArchL: -7.3, browArchR: -7.3,
    cheek: 0.3,
    headY: -3,
    smile: 0.94,
    mouthOpen: 0.18,
  }),
  reassuring: pose({
    eyeL: 0.84, eyeR: 0.86,
    upperLidL: 0.17, upperLidR: 0.15,
    lowerLidL: 0.06, lowerLidR: 0.06,
    browInnerL: -1, browInnerR: -1,
    browOuterL: -0.6, browOuterR: -0.6,
    browArchL: -2.9, browArchR: -2.9,
    cheek: 0.18,
    headTilt: 0.028,
    headY: 0.4,
    smile: 0.43,
  }),
  concerned: pose({
    eyeL: 0.9, eyeR: 0.93,
    upperLidL: 0.12, upperLidR: 0.1,
    lowerLidL: 0.05, lowerLidR: 0.05,
    browInnerL: -7.2, browInnerR: -7.2,
    browOuterL: 1.5, browOuterR: 1.5,
    browArchL: -2.2, browArchR: -2.2,
    headTilt: 0.035,
    headY: 1,
    smile: -0.52,
  }),
  surprised: pose({
    eyeL: 1.28, eyeR: 1.28,
    browInnerL: -9.5, browInnerR: -9.5,
    browOuterL: -9.5, browOuterR: -9.5,
    browArchL: -9, browArchR: -9,
    headY: -4,
    smile: 0,
    mouthOpen: 0.72,
    mouthRound: 1,
  }),
  thoughtful: pose({
    eyeL: 0.88, eyeR: 0.96,
    upperLidL: 0.16, upperLidR: 0.08,
    lowerLidL: 0.03, lowerLidR: 0.02,
    browInnerL: -1.4, browInnerR: -4.8,
    browOuterL: -0.2, browOuterR: -2.2,
    browArchL: -2.6, browArchR: -4.2,
    headTilt: -0.042,
    headY: 0.5,
    smile: 0.02,
    mouthSkew: 0.3,
  }),
  playful: pose({
    eyeL: 0.78, eyeR: 1.03,
    upperLidL: 0.24, upperLidR: 0.03,
    lowerLidL: 0.08, lowerLidR: 0,
    browInnerL: -1.2, browInnerR: -6.5,
    browOuterL: 0.6, browOuterR: -5,
    browArchL: -2, browArchR: -5.6,
    cheek: 0.2,
    headTilt: -0.045,
    smile: 0.72,
    mouthSkew: 0.34,
  }),
};

const blendPose = (a: FacePose, b: FacePose, weight: number): FacePose => {
  const t = clamp(weight);
  const result = {} as FacePose;
  for (const key of Object.keys(a) as Array<keyof FacePose>) result[key] = lerp(a[key], b[key], t);
  return result;
};

/**
 * Milo-specific expressive face rig. The base illustration owns construction;
 * this layer owns emotional readability: eyelids, brows, cheeks and rest-mouth
 * shapes. Visemes remain untouched while speech is active.
 */
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
      p = { ...p,
        eyeL: p.eyeL * 0.97,
        eyeR: p.eyeR * 0.97,
        upperLidL: p.upperLidL + 0.03,
        upperLidR: p.upperLidR + 0.03,
        headY: p.headY - 0.6,
      };
    } else if (input.mode === 'thinking') {
      p = { ...p,
        eyeL: p.eyeL * 0.95,
        upperLidL: p.upperLidL + 0.05,
        mouthSkew: p.mouthSkew + 0.06,
      };
    }

    const micro = Math.sin(input.time * 0.72 + 0.8) * 0.5 + Math.sin(input.time * 0.31 + 2.2) * 0.5;
    const accent = clamp(input.accent);
    p = { ...p,
      browOuterL: p.browOuterL - micro * 0.35 - accent * 0.8,
      browOuterR: p.browOuterR + micro * 0.28 - accent * 0.8,
      eyeL: p.eyeL * (1 + accent * 0.04),
      eyeR: p.eyeR * (1 + accent * 0.04),
      headY: p.headY - accent * 1.2,
    };

    this.layers.eyeLeft.root.scale.y *= Math.max(0.42, p.eyeL);
    this.layers.eyeRight.root.scale.y *= Math.max(0.42, p.eyeR);
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
    const a = clamp(amount, 0, 0.62);
    if (a < 0.015) return;
    const rx = 12;
    const ry = 17;
    if (upper) {
      const y = cy - ry + a * ry * 1.8;
      graphics
        .moveTo(cx - rx - 2, cy - ry - 4)
        .lineTo(cx + rx + 2, cy - ry - 4)
        .lineTo(cx + rx + 2, y)
        .bezierCurveTo(cx + rx * 0.42, y + 2.2, cx - rx * 0.42, y + 2.2, cx - rx - 2, y)
        .closePath()
        .fill(C.paper)
        .moveTo(cx - rx, y)
        .bezierCurveTo(cx - rx * 0.4, y + 1.8, cx + rx * 0.4, y + 1.8, cx + rx, y)
        .stroke({ width: 1.35, color: C.ink, alpha: 0.55, cap: 'round' });
      return;
    }

    const y = cy + ry - a * ry * 1.5;
    graphics
      .moveTo(cx - rx - 2, cy + ry + 4)
      .lineTo(cx + rx + 2, cy + ry + 4)
      .lineTo(cx + rx + 2, y)
      .bezierCurveTo(cx + rx * 0.42, y - 1.8, cx - rx * 0.42, y - 1.8, cx - rx - 2, y)
      .closePath()
      .fill(C.paper)
      .moveTo(cx - rx * 0.9, y)
      .bezierCurveTo(cx - rx * 0.35, y - 1.3, cx + rx * 0.35, y - 1.3, cx + rx * 0.9, y)
      .stroke({ width: 1.1, color: C.ink, alpha: 0.35, cap: 'round' });
  }

  private drawCheekAccents(p: FacePose) {
    this.cheekAccentLeft.clear();
    this.cheekAccentRight.clear();
    if (p.cheek < 0.12) return;
    const alpha = Math.min(0.5, 0.16 + p.cheek * 0.8);
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
      const width = 14 + Math.max(0, p.smile) * 12 + (1 - p.mouthRound) * 4;
      const height = 7 + p.mouthOpen * 13;
      mouth
        .moveTo(-width, 0)
        .bezierCurveTo(-width * 0.58, -height, width * 0.58, -height, width, 0)
        .bezierCurveTo(width * 0.58, height, -width * 0.58, height, -width, 0)
        .closePath()
        .fill(C.ink);
      if (p.smile > 0.35 && p.mouthRound < 0.7) {
        mouth
          .moveTo(-width * 0.55, -height * 0.34)
          .bezierCurveTo(-width * 0.2, -height * 0.52, width * 0.2, -height * 0.52, width * 0.55, -height * 0.34)
          .stroke({ width: 2, color: C.paper, alpha: 0.9, cap: 'round' });
      }
      return;
    }

    const width = 13 + Math.abs(p.smile) * 4;
    const centerY = p.smile * 6.2;
    const skew = p.mouthSkew * 3.2;
    mouth
      .moveTo(-width, skew * 0.35)
      .bezierCurveTo(-width * 0.45, centerY + skew, width * 0.42, centerY - skew * 0.45, width, -skew * 0.35)
      .stroke({ width: 3.25, color: C.ink, cap: 'round' });
  }
}
