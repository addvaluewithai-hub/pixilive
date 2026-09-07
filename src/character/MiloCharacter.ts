import { Container, Graphics, type Ticker } from 'pixi.js';
import type { CharacterSignals, Emotion, MouthPose } from './types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const damp = (from: number, to: number, speed: number, dt: number) => lerp(from, to, 1 - Math.exp(-speed * dt));

const C = {
  paper: 0xf7f5ef,
  paperSoft: 0xe4e1d9,
  ink: 0x0b0c0e,
};

const moods: Record<Emotion, {
  smile: number;
  eye: number;
  brow: number;
  browLift: number;
  energy: number;
  tilt: number;
  lean: number;
}> = {
  calm: { smile: 0.18, eye: 1, brow: 0.01, browLift: 0, energy: 0.18, tilt: 0, lean: 0 },
  happy: { smile: 0.74, eye: 0.9, brow: 0.06, browLift: -2, energy: 0.52, tilt: -0.025, lean: -0.01 },
  curious: { smile: 0.28, eye: 1.04, brow: 0.12, browLift: -4, energy: 0.3, tilt: 0.045, lean: 0.018 },
  excited: { smile: 0.62, eye: 1.08, brow: 0.09, browLift: -3, energy: 0.86, tilt: -0.035, lean: -0.018 },
};

interface EyeParts {
  root: Container;
  highlight: Graphics;
}

export class MiloCharacter {
  readonly view = new Container();

  private readonly root = new Container();
  private readonly body = new Container();
  private readonly shoulders = new Container();
  private readonly head = new Container();
  private readonly hair = new Container();
  private readonly fringe = new Container();
  private readonly armBack = new Container();
  private readonly armFront = new Container();
  private readonly scarf = new Container();
  private readonly mouth = new Graphics();
  private readonly cheekLeft = new Graphics();
  private readonly cheekRight = new Graphics();
  private readonly shadow: Graphics;

  private eyeLeft!: EyeParts;
  private eyeRight!: EyeParts;
  private browLeft!: Graphics;
  private browRight!: Graphics;

  private time = 0;
  private blink = 1;
  private blinkTarget = 1;
  private nextBlink = 2.2;
  private reaction = 0;
  private fringeLag = 0;
  private gaze = { x: 0, y: 0 };
  private gazeTarget = { x: 0, y: 0 };

  private signals: CharacterSignals = {
    emotion: 'calm',
    speaking: false,
    mouth: { open: 0.045, width: 0.37, round: 0.08, energy: 0 },
  };

  private renderedMouth: MouthPose = { ...this.signals.mouth };

  constructor() {
    this.view.addChild(this.root);
    this.shadow = new Graphics().ellipse(0, 237, 111, 17).fill({ color: C.paper, alpha: 0.075 });
    this.root.addChild(this.shadow);
    this.buildBody();
    this.buildHead();
    this.drawMouth(this.renderedMouth, moods.calm.smile);
  }

  setEmotion(emotion: Emotion) {
    this.signals.emotion = emotion;
    this.react();
  }

  setMouth(pose: MouthPose, speaking = true) {
    this.signals.mouth = {
      open: clamp(pose.open),
      width: clamp(pose.width),
      round: clamp(pose.round),
      energy: clamp(pose.energy),
    };
    this.signals.speaking = speaking;
  }

  settleMouth() {
    this.signals.mouth = { open: 0.045, width: 0.37, round: 0.08, energy: 0 };
    this.signals.speaking = false;
  }

  lookAt(x: number, y: number) {
    this.gazeTarget.x = clamp(x, -1, 1);
    this.gazeTarget.y = clamp(y, -1, 1);
  }

  react() {
    this.reaction = 1;
  }

  update(ticker: Ticker) {
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    this.time += dt;
    const mood = moods[this.signals.emotion];

    this.gaze.x = damp(this.gaze.x, this.gazeTarget.x, 8.5, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeTarget.y, 8.5, dt);
    this.renderedMouth.open = damp(this.renderedMouth.open, this.signals.mouth.open, 22, dt);
    this.renderedMouth.width = damp(this.renderedMouth.width, this.signals.mouth.width, 16, dt);
    this.renderedMouth.round = damp(this.renderedMouth.round, this.signals.mouth.round, 16, dt);
    this.renderedMouth.energy = damp(this.renderedMouth.energy, this.signals.mouth.energy, 16, dt);
    this.reaction = damp(this.reaction, 0, 4.8, dt);

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkTarget = 0.04;
      this.nextBlink = 2.25 + Math.random() * 3.6;
      window.setTimeout(() => (this.blinkTarget = 1), 88 + Math.random() * 58);
    }
    this.blink = damp(this.blink, this.blinkTarget, 34, dt);

    const breathe = (Math.sin(this.time * 1.9) + 1) * 0.5;
    const drift = Math.sin(this.time * 0.82);
    const speech = this.renderedMouth.energy;

    this.root.y = drift * 2.2 - this.reaction * 8 + speech * Math.sin(this.time * 13.5) * 1.7;
    this.root.rotation = Math.sin(this.time * 0.55) * 0.007 + mood.lean + this.reaction * 0.01;
    this.root.scale.set(1 + this.reaction * 0.012);
    this.shadow.scale.x = 1 - drift * 0.015 - this.reaction * 0.03;

    this.body.y = 88 + breathe * 1.5;
    this.body.scale.y = 1 + breathe * 0.008;
    this.shoulders.rotation = Math.sin(this.time * 0.9) * 0.004;
    this.armBack.rotation = 0.018 + Math.sin(this.time * 0.78) * 0.006 - this.reaction * 0.018;
    this.armFront.rotation = -0.014 - Math.sin(this.time * 0.82 + 0.7) * 0.006 + this.reaction * 0.014;

    this.head.position.set(this.gaze.x * 2.2, -57 + this.gaze.y * 1.4 - this.reaction * 2.5);
    this.head.rotation = mood.tilt + Math.sin(this.time * 0.72) * 0.01 + this.gaze.x * 0.019 - this.gaze.y * 0.005;

    const fringeTarget = -this.head.rotation * 0.62 - this.gaze.x * 0.014;
    this.fringeLag = damp(this.fringeLag, fringeTarget, 5.2, dt);
    this.fringe.rotation = this.fringeLag + Math.sin(this.time * 1.15) * 0.006;
    this.hair.rotation = Math.sin(this.time * 0.65) * 0.004 - this.gaze.x * 0.004;
    this.scarf.rotation = -this.head.rotation * 0.18 + Math.sin(this.time * 0.9) * 0.004;

    const eyeScale = mood.eye * this.blink;
    this.eyeLeft.root.scale.y = eyeScale;
    this.eyeRight.root.scale.y = eyeScale;
    const lookX = this.gaze.x * 2.4;
    const lookY = this.gaze.y * 1.7;
    this.eyeLeft.highlight.position.set(lookX, lookY);
    this.eyeRight.highlight.position.set(lookX, lookY);

    this.browLeft.rotation = -mood.brow + this.gaze.y * 0.018;
    this.browRight.rotation = mood.brow - this.gaze.y * 0.018;
    this.browLeft.y = -31 + mood.browLift;
    this.browRight.y = -31 + mood.browLift + (this.signals.emotion === 'curious' ? -5 : 0);

    const cheekAlpha = this.signals.emotion === 'happy' || this.signals.emotion === 'excited' ? 0.45 : 0.14;
    this.cheekLeft.alpha = cheekAlpha + speech * 0.08;
    this.cheekRight.alpha = cheekAlpha + speech * 0.08;
    this.drawMouth(this.renderedMouth, mood.smile);
  }

  private buildBody() {
    this.body.y = 88;
    this.root.addChild(this.body);

    const torso = new Graphics()
      .moveTo(-72, -6)
      .bezierCurveTo(-88, 20, -92, 92, -82, 171)
      .bezierCurveTo(-48, 188, 49, 188, 82, 171)
      .bezierCurveTo(92, 92, 88, 20, 72, -6)
      .bezierCurveTo(48, -24, -48, -24, -72, -6)
      .closePath()
      .fill(C.ink)
      .stroke({ width: 4, color: C.paper, alpha: 0.94, join: 'round' });

    const collar = new Graphics()
      .moveTo(-25, -13)
      .bezierCurveTo(-16, 4, -8, 14, 0, 21)
      .bezierCurveTo(8, 14, 16, 4, 25, -13)
      .stroke({ width: 3, color: C.paper, alpha: 0.6, cap: 'round' });

    const hem = new Graphics()
      .moveTo(-62, 160)
      .bezierCurveTo(-28, 168, 30, 168, 63, 160)
      .stroke({ width: 2, color: C.paper, alpha: 0.36, cap: 'round' });

    this.body.addChild(torso, collar, hem);
    this.shoulders.y = 16;
    this.body.addChild(this.shoulders);

    this.armBack.position.set(-28, 48);
    this.armBack.pivot.set(-22, 0);
    this.armBack.addChild(
      new Graphics()
        .moveTo(-60, -8)
        .bezierCurveTo(-73, 11, -68, 37, -50, 50)
        .lineTo(43, 75)
        .bezierCurveTo(56, 79, 68, 67, 63, 53)
        .lineTo(56, 34)
        .bezierCurveTo(51, 22, 37, 15, 24, 19)
        .lineTo(-37, 33)
        .bezierCurveTo(-46, 15, -51, 1, -60, -8)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 4, color: C.ink, join: 'round' }),
    );
    this.armBack.addChild(this.makeFingerLines(26, 28, false));

    this.armFront.position.set(23, 69);
    this.armFront.pivot.set(8, 0);
    this.armFront.addChild(
      new Graphics()
        .moveTo(58, -15)
        .bezierCurveTo(71, 5, 67, 30, 48, 42)
        .lineTo(-51, 59)
        .bezierCurveTo(-66, 62, -77, 49, -72, 35)
        .lineTo(-65, 17)
        .bezierCurveTo(-60, 5, -45, -3, -31, 1)
        .lineTo(38, 18)
        .bezierCurveTo(44, 4, 49, -7, 58, -15)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 4, color: C.ink, join: 'round' }),
    );
    this.armFront.addChild(this.makeFingerLines(-36, 8, true));

    this.shoulders.addChild(this.armBack, this.armFront);
  }

  private buildHead() {
    this.head.y = -57;
    this.root.addChild(this.head);

    this.scarf.position.set(2, 99);
    this.scarf.addChild(
      new Graphics()
        .moveTo(-29, -9)
        .bezierCurveTo(-25, 10, -16, 24, 0, 31)
        .bezierCurveTo(16, 24, 25, 10, 29, -9)
        .bezierCurveTo(15, -1, -15, -1, -29, -9)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 4, color: C.ink, join: 'round' }),
      new Graphics()
        .moveTo(5, 22)
        .lineTo(27, 42)
        .bezierCurveTo(32, 48, 28, 53, 22, 49)
        .lineTo(3, 31)
        .closePath()
        .fill(C.paper)
        .stroke({ width: 3, color: C.ink, join: 'round' }),
    );
    this.head.addChild(this.scarf);

    const ears = new Graphics()
      .ellipse(-82, 7, 16, 22)
      .ellipse(82, 7, 16, 22)
      .fill(C.paper)
      .stroke({ width: 4, color: C.ink });

    const face = new Graphics()
      .moveTo(-74, -38)
      .bezierCurveTo(-88, -5, -82, 47, -55, 75)
      .bezierCurveTo(-31, 101, 8, 107, 39, 91)
      .bezierCurveTo(72, 74, 88, 39, 80, -4)
      .bezierCurveTo(74, -39, 40, -66, 1, -69)
      .bezierCurveTo(-30, -72, -61, -61, -74, -38)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 4.5, color: C.ink, join: 'round' });

    this.head.addChild(ears, face);

    this.hair.addChild(
      new Graphics()
        .moveTo(-72, -29)
        .bezierCurveTo(-67, -68, -41, -93, -6, -95)
        .bezierCurveTo(28, -97, 59, -80, 76, -48)
        .bezierCurveTo(64, -55, 52, -57, 41, -53)
        .bezierCurveTo(27, -69, 9, -75, -10, -70)
        .bezierCurveTo(-27, -66, -36, -53, -41, -38)
        .bezierCurveTo(-52, -44, -64, -40, -72, -29)
        .closePath()
        .fill(C.ink)
        .stroke({ width: 3, color: C.paper, alpha: 0.8, join: 'round' }),
    );
    this.head.addChild(this.hair);

    this.fringe.position.set(-10, -52);
    this.fringe.addChild(
      new Graphics()
        .moveTo(-48, 4)
        .bezierCurveTo(-33, -17, -10, -27, 9, -19)
        .bezierCurveTo(20, -14, 24, -2, 20, 10)
        .bezierCurveTo(14, 26, -1, 33, -14, 25)
        .bezierCurveTo(-24, 39, -42, 34, -46, 20)
        .bezierCurveTo(-49, 13, -50, 8, -48, 4)
        .closePath()
        .fill(C.ink),
      new Graphics()
        .moveTo(13, -14)
        .bezierCurveTo(38, -15, 56, -2, 67, 16)
        .bezierCurveTo(51, 8, 37, 9, 22, 17)
        .bezierCurveTo(26, 2, 22, -7, 13, -14)
        .closePath()
        .fill(C.ink),
    );
    this.head.addChild(this.fringe);

    this.eyeLeft = this.makeEye(-33, 1);
    this.eyeRight = this.makeEye(34, -1);
    this.head.addChild(this.eyeLeft.root, this.eyeRight.root);

    this.browLeft = this.makeBrow(-33);
    this.browRight = this.makeBrow(34);
    this.head.addChild(this.browLeft, this.browRight);

    this.head.addChild(
      new Graphics()
        .moveTo(-3, 2)
        .bezierCurveTo(-7, 10, -7, 16, 1, 18)
        .bezierCurveTo(5, 19, 8, 17, 9, 14)
        .stroke({ width: 3.2, color: C.ink, cap: 'round', join: 'round' }),
    );

    this.cheekLeft
      .moveTo(-63, 31).lineTo(-53, 29)
      .moveTo(-61, 37).lineTo(-51, 35)
      .stroke({ width: 2, color: C.ink, alpha: 0.3, cap: 'round' });
    this.cheekRight
      .moveTo(53, 29).lineTo(63, 31)
      .moveTo(51, 35).lineTo(61, 37)
      .stroke({ width: 2, color: C.ink, alpha: 0.3, cap: 'round' });
    this.head.addChild(this.cheekLeft, this.cheekRight);

    this.mouth.y = 46;
    this.head.addChild(this.mouth);
  }

  private makeEye(x: number, direction: 1 | -1): EyeParts {
    const root = new Container();
    root.position.set(x, -4);
    const eye = new Graphics().ellipse(0, 0, 10.5, 15).fill(C.ink);
    const highlight = new Graphics().circle(direction * -1.5, -2.8, 2.5).fill(C.paper);
    root.addChild(eye, highlight);
    return { root, highlight };
  }

  private makeBrow(x: number) {
    const brow = new Graphics()
      .moveTo(-16, 0)
      .bezierCurveTo(-6, -4, 7, -4, 16, 0)
      .stroke({ width: 4, color: C.ink, cap: 'round' });
    brow.position.set(x, -31);
    return brow;
  }

  private makeFingerLines(x: number, y: number, mirror: boolean) {
    const hand = new Graphics();
    const s = mirror ? -1 : 1;
    hand
      .moveTo(x - 14 * s, y + 2).bezierCurveTo(x - 7 * s, y - 9, x + 1 * s, y - 8, x + 5 * s, y + 1)
      .moveTo(x - 7 * s, y + 4).bezierCurveTo(x - 1 * s, y - 7, x + 7 * s, y - 7, x + 10 * s, y + 2)
      .moveTo(x, y + 7).bezierCurveTo(x + 5 * s, y - 2, x + 12 * s, y - 1, x + 13 * s, y + 7)
      .stroke({ width: 2.5, color: C.ink, cap: 'round' });
    return hand;
  }

  private drawMouth(pose: MouthPose, smile: number) {
    this.mouth.clear();
    const width = 22 + pose.width * 28 - pose.round * 8;
    const height = 4 + pose.open * 29 + pose.round * 9;
    const smileLift = smile * 8;

    if (pose.open < 0.13) {
      this.mouth
        .moveTo(-width * 0.52, 0)
        .bezierCurveTo(-width * 0.18, 5 - smileLift, width * 0.17, 5 - smileLift, width * 0.52, -1)
        .stroke({ width: 4, color: C.ink, cap: 'round' });
      return;
    }

    this.mouth
      .roundRect(-width / 2, -height / 2 - smile * 1.5, width, height, Math.max(4, Math.min(height * 0.48, 13)))
      .fill(C.ink);

    if (pose.open > 0.42) {
      this.mouth
        .roundRect(-width * 0.3, -height * 0.43 - smile * 1.5, width * 0.6, Math.max(2.5, height * 0.12), 3)
        .fill(C.paper);
    }

    if (pose.open > 0.66 && pose.round < 0.68) {
      this.mouth
        .ellipse(0, height * 0.22 - smile * 1.5, width * 0.23, Math.max(2, height * 0.13))
        .fill({ color: C.paperSoft, alpha: 0.9 });
    }
  }
}
