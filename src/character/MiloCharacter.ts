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
    this.shadow = new Graphics().ellipse(0, 233, 105, 15).fill({ color: C.paper, alpha: 0.065 });
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

    this.root.y = drift * 2.1 - this.reaction * 7 + speech * Math.sin(this.time * 13.5) * 1.5;
    this.root.rotation = Math.sin(this.time * 0.55) * 0.006 + mood.lean + this.reaction * 0.009;
    this.root.scale.set(1 + this.reaction * 0.011);
    this.shadow.scale.x = 1 - drift * 0.014 - this.reaction * 0.025;

    this.body.y = 84 + breathe * 1.1;
    this.body.scale.y = 1 + breathe * 0.006;
    this.shoulders.rotation = Math.sin(this.time * 0.9) * 0.0025;
    this.armBack.rotation = 0.006 + Math.sin(this.time * 0.78) * 0.0025 - this.reaction * 0.008;
    this.armFront.rotation = -0.005 - Math.sin(this.time * 0.82 + 0.7) * 0.0025 + this.reaction * 0.007;

    this.head.position.set(this.gaze.x * 2.1, -50 + this.gaze.y * 1.3 - this.reaction * 2.2);
    this.head.rotation = mood.tilt + Math.sin(this.time * 0.72) * 0.009 + this.gaze.x * 0.018 - this.gaze.y * 0.005;

    const fringeTarget = -this.head.rotation * 0.62 - this.gaze.x * 0.014;
    this.fringeLag = damp(this.fringeLag, fringeTarget, 5.2, dt);
    this.fringe.rotation = this.fringeLag + Math.sin(this.time * 1.15) * 0.005;
    this.hair.rotation = Math.sin(this.time * 0.65) * 0.0035 - this.gaze.x * 0.004;

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
    this.body.y = 84;
    this.root.addChild(this.body);

    const neck = new Graphics()
      .moveTo(-13, -35)
      .bezierCurveTo(-13, -24, -12, -13, -17, -5)
      .bezierCurveTo(-8, 1, 8, 1, 17, -5)
      .bezierCurveTo(12, -13, 13, -24, 13, -35)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 3.2, color: C.ink, join: 'round' });

    const torso = new Graphics()
      .moveTo(-68, -2)
      .bezierCurveTo(-82, 6, -90, 32, -91, 67)
      .bezierCurveTo(-93, 111, -89, 150, -82, 172)
      .bezierCurveTo(-46, 187, 46, 187, 82, 172)
      .bezierCurveTo(89, 150, 93, 111, 91, 67)
      .bezierCurveTo(90, 32, 82, 6, 68, -2)
      .bezierCurveTo(43, -16, -43, -16, -68, -2)
      .closePath()
      .fill(C.ink)
      .stroke({ width: 4, color: C.paper, alpha: 0.94, join: 'round' });

    const collar = new Graphics()
      .moveTo(-33, -7)
      .bezierCurveTo(-22, -4, -11, 2, 0, 15)
      .bezierCurveTo(11, 2, 22, -4, 33, -7)
      .stroke({ width: 3, color: C.paper, alpha: 0.66, cap: 'round', join: 'round' });

    const hem = new Graphics()
      .moveTo(-62, 159)
      .bezierCurveTo(-28, 167, 30, 167, 63, 159)
      .stroke({ width: 2, color: C.paper, alpha: 0.3, cap: 'round' });

    this.body.addChild(neck, torso, collar, hem);
    this.shoulders.y = 7;
    this.body.addChild(this.shoulders);

    this.buildBackArm();
    this.buildFrontArm();
    this.shoulders.addChild(this.armBack, this.armFront);
  }

  private buildBackArm() {
    this.armBack.position.set(0, 0);

    const upper = new Graphics()
      .moveTo(-58, 3)
      .bezierCurveTo(-72, 16, -78, 40, -76, 56)
      .bezierCurveTo(-74, 68, -68, 75, -59, 76)
      .bezierCurveTo(-50, 77, -44, 71, -42, 63)
      .bezierCurveTo(-45, 48, -40, 29, -29, 15)
      .bezierCurveTo(-37, 9, -48, 5, -58, 3)
      .closePath()
      .fill(C.ink)
      .stroke({ width: 3.2, color: C.paper, alpha: 0.9, join: 'round' });

    const forearm = new Graphics()
      .moveTo(-64, 57)
      .bezierCurveTo(-71, 61, -72, 70, -67, 76)
      .bezierCurveTo(-63, 81, -57, 83, -50, 81)
      .lineTo(50, 57)
      .bezierCurveTo(58, 55, 63, 49, 61, 43)
      .bezierCurveTo(59, 36, 52, 33, 45, 35)
      .lineTo(-54, 59)
      .bezierCurveTo(-57, 59, -61, 57, -64, 57)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 3.5, color: C.ink, join: 'round' });

    const wrist = new Graphics()
      .moveTo(36, 38)
      .bezierCurveTo(40, 43, 42, 49, 42, 57)
      .stroke({ width: 1.8, color: C.ink, alpha: 0.42, cap: 'round' });

    this.armBack.addChild(upper, forearm, wrist, this.makeHandLines(48, 37, false));
  }

  private buildFrontArm() {
    this.armFront.position.set(0, 0);

    const upper = new Graphics()
      .moveTo(58, 5)
      .bezierCurveTo(72, 18, 79, 43, 77, 59)
      .bezierCurveTo(75, 71, 68, 79, 59, 80)
      .bezierCurveTo(50, 81, 43, 74, 41, 66)
      .bezierCurveTo(45, 50, 40, 31, 29, 16)
      .bezierCurveTo(37, 10, 48, 6, 58, 5)
      .closePath()
      .fill(C.ink)
      .stroke({ width: 3.2, color: C.paper, alpha: 0.9, join: 'round' });

    const forearm = new Graphics()
      .moveTo(65, 62)
      .bezierCurveTo(72, 66, 72, 76, 67, 82)
      .bezierCurveTo(63, 87, 56, 89, 49, 87)
      .lineTo(-51, 62)
      .bezierCurveTo(-59, 60, -64, 54, -62, 48)
      .bezierCurveTo(-60, 41, -53, 38, -45, 40)
      .lineTo(55, 64)
      .bezierCurveTo(58, 65, 62, 63, 65, 62)
      .closePath()
      .fill(C.paper)
      .stroke({ width: 3.5, color: C.ink, join: 'round' });

    const wrist = new Graphics()
      .moveTo(-36, 43)
      .bezierCurveTo(-40, 48, -42, 54, -42, 62)
      .stroke({ width: 1.8, color: C.ink, alpha: 0.42, cap: 'round' });

    this.armFront.addChild(upper, forearm, wrist, this.makeHandLines(-48, 42, true));
  }

  private buildHead() {
    this.head.y = -50;
    this.root.addChild(this.head);

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

  private makeHandLines(x: number, y: number, mirror: boolean) {
    const hand = new Graphics();
    const s = mirror ? -1 : 1;
    hand
      .moveTo(x - 9 * s, y + 3)
      .bezierCurveTo(x - 5 * s, y - 4, x, y - 5, x + 4 * s, y + 1)
      .moveTo(x - 2 * s, y + 5)
      .bezierCurveTo(x + 2 * s, y - 2, x + 7 * s, y - 2, x + 10 * s, y + 3)
      .stroke({ width: 1.9, color: C.ink, cap: 'round' });
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
