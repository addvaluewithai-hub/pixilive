import { Graphics, type Container, type Ticker } from 'pixi.js';
import { MiloCharacter } from './MiloCharacter';
import type { Emotion, MouthPose, Viseme } from './types';

const C = {
  paper: 0xf7f5ef,
  paperSoft: 0xe4e1d9,
  ink: 0x0b0c0e,
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, speed: number, dt: number) => lerp(a, b, 1 - Math.exp(-speed * dt));

const restPose: MouthPose = {
  open: 0.035,
  width: 0.4,
  round: 0.06,
  energy: 0,
  viseme: 'REST',
  lipPress: 0.08,
  lowerLipBite: 0,
  teeth: 0,
  tongue: 0,
  cornerPull: 0.1,
};

const completePose = (pose: MouthPose): Required<MouthPose> => ({
  open: clamp(pose.open),
  width: clamp(pose.width),
  round: clamp(pose.round),
  energy: clamp(pose.energy),
  viseme: pose.viseme ?? 'REST',
  lipPress: clamp(pose.lipPress ?? 0),
  lowerLipBite: clamp(pose.lowerLipBite ?? 0),
  teeth: clamp(pose.teeth ?? 0),
  tongue: clamp(pose.tongue ?? 0),
  cornerPull: clamp(pose.cornerPull ?? 0),
});

/**
 * A mouth-rig decorator for Milo.
 *
 * Milo's original procedural body/face remains the source of truth. We hide its
 * legacy mouth layer and add a richer mouth layer that consumes the shared
 * viseme signals. This keeps the character runtime backward-compatible while
 * the shared mouth contract evolves for future characters.
 */
export class MiloVisemeCharacter {
  readonly view: Container;

  private readonly base = new MiloCharacter();
  private readonly mouth = new Graphics();
  private target = completePose(restPose);
  private rendered = completePose(restPose);
  private speaking = false;
  private smile = 0.18;

  constructor() {
    this.view = this.base.view;

    // TypeScript `private` is compile-time only here; these are stable layers of
    // our own Milo implementation. Keeping the adapter isolated in this file
    // prevents the shared character runtime from depending on Milo internals.
    const layers = this.base as unknown as { head: Container; mouth: Graphics };
    layers.mouth.visible = false;
    this.mouth.y = 46;
    layers.head.addChild(this.mouth);
    this.drawMouth();
  }

  setEmotion(emotion: Emotion) {
    this.base.setEmotion(emotion);
    this.smile = emotion === 'happy' ? 0.72 : emotion === 'excited' ? 0.58 : emotion === 'curious' ? 0.26 : 0.18;
  }

  setMouth(pose: MouthPose, speaking = true) {
    this.target = completePose(pose);
    this.speaking = speaking;
    this.base.setMouth(pose, speaking);
  }

  settleMouth() {
    this.target = completePose(restPose);
    this.speaking = false;
    this.base.settleMouth();
  }

  lookAt(normalizedX: number, normalizedY: number) {
    this.base.lookAt(normalizedX, normalizedY);
  }

  react() {
    this.base.react();
  }

  update(ticker: Ticker) {
    this.base.update(ticker);
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    const speed = this.target.viseme === 'MBP' ? 32 : 24;

    this.rendered.open = damp(this.rendered.open, this.target.open, speed, dt);
    this.rendered.width = damp(this.rendered.width, this.target.width, 20, dt);
    this.rendered.round = damp(this.rendered.round, this.target.round, 22, dt);
    this.rendered.energy = damp(this.rendered.energy, this.target.energy, 19, dt);
    this.rendered.lipPress = damp(this.rendered.lipPress, this.target.lipPress, 28, dt);
    this.rendered.lowerLipBite = damp(this.rendered.lowerLipBite, this.target.lowerLipBite, 28, dt);
    this.rendered.teeth = damp(this.rendered.teeth, this.target.teeth, 22, dt);
    this.rendered.tongue = damp(this.rendered.tongue, this.target.tongue, 20, dt);
    this.rendered.cornerPull = damp(this.rendered.cornerPull, this.target.cornerPull, 20, dt);
    this.rendered.viseme = this.target.viseme;

    this.drawMouth();
  }

  private drawMouth() {
    const p = this.rendered;
    const viseme = p.viseme as Viseme;
    this.mouth.clear();

    if (!this.speaking || viseme === 'REST' || p.energy < 0.025) {
      this.drawRestingMouth();
      return;
    }

    if (viseme === 'MBP' || p.lipPress > 0.58) {
      this.drawPressedLips();
      return;
    }

    if (viseme === 'FV' || p.lowerLipBite > 0.52) {
      this.drawFvMouth();
      return;
    }

    this.drawOpenMouth(viseme);
  }

  private drawRestingMouth() {
    const width = 18 + this.rendered.width * 23;
    const lift = this.smile * 5.5;
    this.mouth
      .moveTo(-width / 2, 0)
      .bezierCurveTo(-width * 0.22, 3.8 - lift, width * 0.16, 4.2 - lift, width / 2, -0.6)
      .stroke({ width: 3.4, color: C.ink, cap: 'round' });
  }

  private drawPressedLips() {
    const width = 22 + this.rendered.width * 24;
    const pull = this.rendered.cornerPull * 2.5;
    this.mouth
      .moveTo(-width / 2, 0)
      .bezierCurveTo(-width * 0.22, -1.7 - pull, width * 0.2, -1.5 - pull, width / 2, 0)
      .bezierCurveTo(width * 0.18, 2.2, -width * 0.2, 2.2, -width / 2, 0)
      .fill(C.ink);

    this.mouth
      .moveTo(-width * 0.34, 0.4)
      .bezierCurveTo(-width * 0.1, 1.3, width * 0.1, 1.3, width * 0.34, 0.4)
      .stroke({ width: 1.25, color: C.paper, alpha: 0.4, cap: 'round' });
  }

  private drawFvMouth() {
    const width = 23 + this.rendered.width * 25;
    const height = 8 + this.rendered.open * 12;
    const half = width / 2;

    this.mouth
      .moveTo(-half, 0)
      .bezierCurveTo(-half * 0.58, -height * 0.62, half * 0.58, -height * 0.62, half, 0)
      .bezierCurveTo(half * 0.58, height * 0.5, -half * 0.58, height * 0.5, -half, 0)
      .closePath()
      .fill(C.ink);

    this.mouth
      .moveTo(-half * 0.68, -0.8)
      .bezierCurveTo(-half * 0.35, -height * 0.42, half * 0.35, -height * 0.42, half * 0.68, -0.8)
      .bezierCurveTo(half * 0.38, 1.8, -half * 0.38, 1.8, -half * 0.68, -0.8)
      .closePath()
      .fill(C.paper);

    this.mouth
      .moveTo(-half * 0.5, height * 0.2)
      .bezierCurveTo(-half * 0.18, -0.2, half * 0.18, -0.2, half * 0.5, height * 0.2)
      .stroke({ width: 2.2, color: C.paperSoft, alpha: 0.92, cap: 'round' });
  }

  private drawOpenMouth(viseme: Viseme) {
    const roundNarrowing = this.rendered.round * 8;
    const width = 23 + this.rendered.width * 28 - roundNarrowing;
    const height = 6 + this.rendered.open * 27 + this.rendered.round * 4;
    const half = Math.max(9, width / 2);
    const top = height * (viseme === 'EE' ? 0.28 : 0.4);
    const bottom = height * (viseme === 'OO' ? 0.55 : 0.62);
    const cornerLift = (this.smile * 2.2 + this.rendered.cornerPull * 1.7) * (1 - this.rendered.round * 0.65);

    this.mouth
      .moveTo(-half, cornerLift)
      .bezierCurveTo(-half * 0.62, -top, half * 0.62, -top, half, cornerLift)
      .bezierCurveTo(half * 0.62, bottom, -half * 0.62, bottom, -half, cornerLift)
      .closePath()
      .fill(C.ink);

    if (this.rendered.teeth > 0.08) {
      const teethWidth = half * (0.48 + this.rendered.teeth * 0.28);
      const teethDepth = Math.max(2.2, height * (0.08 + this.rendered.teeth * 0.12));
      this.mouth
        .moveTo(-teethWidth, -top * 0.5)
        .bezierCurveTo(-teethWidth * 0.45, -top * 0.72, teethWidth * 0.45, -top * 0.72, teethWidth, -top * 0.5)
        .lineTo(teethWidth * 0.9, -top * 0.5 + teethDepth)
        .bezierCurveTo(teethWidth * 0.35, -top * 0.34 + teethDepth, -teethWidth * 0.35, -top * 0.34 + teethDepth, -teethWidth * 0.9, -top * 0.5 + teethDepth)
        .closePath()
        .fill(C.paper);
    }

    if (this.rendered.tongue > 0.12 && height > 13) {
      if (viseme === 'L') {
        const tongueWidth = half * 0.34;
        this.mouth
          .moveTo(-tongueWidth, bottom * 0.52)
          .bezierCurveTo(-tongueWidth * 0.7, bottom * 0.05, -tongueWidth * 0.3, -top * 0.1, 0, -top * 0.13)
          .bezierCurveTo(tongueWidth * 0.3, -top * 0.1, tongueWidth * 0.7, bottom * 0.05, tongueWidth, bottom * 0.52)
          .bezierCurveTo(tongueWidth * 0.45, bottom * 0.72, -tongueWidth * 0.45, bottom * 0.72, -tongueWidth, bottom * 0.52)
          .closePath()
          .fill({ color: C.paperSoft, alpha: 0.94 });
      } else {
        this.mouth
          .ellipse(0, bottom * 0.55, half * (0.22 + this.rendered.tongue * 0.1), Math.max(2, bottom * 0.18))
          .fill({ color: C.paperSoft, alpha: 0.82 });
      }
    }
  }
}
