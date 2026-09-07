import { Container, Graphics, type Ticker } from 'pixi.js';
import type { CharacterSignals, Emotion, MouthPose } from './types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const damp = (from: number, to: number, speed: number, dt: number) => lerp(from, to, 1 - Math.exp(-speed * dt));

const palette = {
  paper: 0xf7f5ef,
  paperSoft: 0xe9e6de,
  ink: 0x0b0c0e,
  inkSoft: 0x23262b,
  mid: 0xa9a9a4,
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
  pupil: Graphics;
}

export class MiloCharacter {
  readonly view = new Container();

  private readonly character = new Container();
  private readonly body = new Container();
  private readonly shoulders = new Container();
  private readonly head = new Container();
  private readonly hair = new Container();
  private readonly fringe = new Container();
  private readonly armBack = new Container();
  private readonly armFront = new Container();
  private readonly handBack = new Container();
  private readonly handFront = new Container();
  private readonly eyeLeft: EyeParts;
  private readonly eyeRight: EyeParts;
  private readonly browLeft: Graphics;
  private readonly browRight: Graphics;
  private readonly mouth = new Graphics();
  private readonly cheekLeft = new Graphics();
  private readonly cheekRight = new Graphics();
  private readonly neckScarf = new Container();
  private readonly shadow: Graphics;

  private time = 0;
  private gaze = { x: 0, y: 0 };
  private gazeTarget = { x: 0, y: 0 };
  private blink = 1;
  private blinkTarget = 1;
  private nextBlink = 2.1;
  private reaction = 0;
  private fringeLag = 0;

  private signals: CharacterSignals = {
    emotion: 'calm',
    speaking: false,
    mouth: { open: 0.05, width: 0.35, round: 0.12, energy: 0 },
  };

  private renderedMouth: MouthPose = { ...this.signals.mouth };

  constructor() {
    this.view.addChild(this.character);

    this.shadow = new Graphics()
      .ellipse(0, 236, 112, 18)
      .fill({ color: palette.paper, alpha: 0.08 });
    this.character.addChild(this.shadow);

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

  lookAt(normalizedX: number, normalizedY: number) {
    this.gazeTarget.x = clamp(normalizedX, -1, 1);
    this.gazeTarget.y = clamp(normalizedY, -1, 1);
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
      this.nextBlink = 2.3 + Math.random() * 3.4;
      window.setTimeout(() => (this.blinkTarget = 1), 88 + Math.random() * 56);
    }
    this.blink = damp(this.blink, this.blinkTarget, 34, dt);

    const breathe = (Math.sin(this.time * 1.9) + 1) * 0.5;
    const drift = Math.sin(this.time * 0.82);
    const speech = this.renderedMouth.energy;
    const speechNod = speech * Math.sin(this.time * 13.5) * 1.7;

    this.character.y = drift * 2.2 - this.reaction * 8 + speechNod;
    this.character.rotation = Math.sin(this.time * 0.55) * 0.007 + mood.lean + this.reaction * 0.01;
    this.character.scale.set(1 + this.reaction * 0.012);

    this.shadow.scale.x = 1 - drift * 0.015 - this.reaction * 0.03;
    this.shadow.alpha = 0.07 - drift * 0.006;

    this.body.y = 87 + breathe * 1.5;
    this.body.scale.y = 1 + breathe * 0.008;
    this.shoulders.rotation = Math.sin(this.time * 0.9) * 0.004;
    this.armBack.rotation = 0.018 + Math.sin(this.time * 0.78) * 0.006 - this.reaction * 0.018;
    this.armFront.rotation = -0.014 - Math.sin(this.time * 0.82 + 0.7) * 0.006 + this.reaction * 0.014;
    this.handBack.rotation = Math.sin(this.time * 1.05) * 0.012;
    this.handFront.rotation = -Math.sin(this.time * 1.1 + 0.4) * 0.012;

    this.head.position.set(this.gaze.x * 2.3, -56 + this.gaze.y * 1.5 - this.reaction * 2.4);
    this.head.rotation = mood.tilt + Math.sin(this.time * 0.72) * 0.01 + this.gaze.x * 0.019 - this.gaze.y * 0.005;

    const targetFringe = -this.head.rotation * 0.65 - this.gaze.x * 0.015;
    this.fringeLag = damp(this.fringeLag, targetFringe, 5.2, dt);
    this.fringe.rotation = this.fringeLag + Math.sin(this.time * 1.15) * 0.006;
    this.hair.rotation = Math.sin(this.time * 0.65) * 0.004 - this.gaze.x * 0.004;

    const eyeScale = mood.eye * this.blink;
    this.eyeLeft.root.scale.y = eyeScale;
    this.eyeRight.root.scale.y = eyeScale;
    const pupilX = this.gaze.x * 3.4;
    const pupilY = this.gaze.y * 2.2;
    this.eyeLeft.pupil.position.set(pupilX, pupilY);
    this.eyeRight.pupil.position.set(pupilX, pupilY);

    this.browLeft.rotation = -mood.brow + this.gaze.y * 0.018;
    this.browRight.rotation = mood.brow - this.gaze.y * 0.018;
    this.browLeft.y = -31 + mood.browLift;
    this.browRight.y = -31 + mood.browLift + (this.signals.emotion === 'curious' ? -5 : 0);

    const cheekAlpha = this.signals.emotion === 'happy' || this.signals.emotion === 'excited' ? 0.48 : 0.16;
    this.cheekLeft.alpha = cheekAlpha + speech * 0.08;
    this.cheekRight.alpha = cheekAlpha + speech * 0.08;

    this.neckScarf.rotation = -this.head.rotation * 0.18 + Math.sin(this.time * 0.9) * 0.004;
    this.drawMouth(this.renderedMouth, mood.smile);
  }

  private buildBody() {
    this.body.y = 87;
    this.character.addChild(this.body);

    const torso = new Graphics()
      .moveTo(-72, -6)
      .bezierCurveTo(-88, 18, -92, 92, -82, 171)
      .bezierCurveTo(-50, 188, 49, 188, 82, 171)
      .bezierCurveTo(92, 93, 88, 18, 72, -6)
      .bezierCurveTo(48, -24, -48, -24, -72, -6)
      .closePath()
      .fill(palette.ink)
      .stroke({ width: 4, color: palette.paper, alpha: 0.95, join: 'round' });

    const shirtOpening = new Graphics()
      .moveTo(-22, -13)
      .bezierCurveTo(-14, 4, -8, 14, 0, 21)
      .bezierCurveTo(8, 14, 14, 4, 22, -13)
      .stroke({ width: 3, color: palette.paper, alpha: 0.6, cap: 'round' });

    const hem = new Graphics()
      .moveTo(-62, 160)
      .bezierCurveTo(-28, 168, 30, 168, 63, 160)
      .stroke({ width: 2, color: palette.paper, alpha: 0.38, cap: 'round' });

    this.body.addChild(torso, shirtOpening, hem);

    this.shoulders.y = 14;
    this.body.addChild(this.shoulders);

    this.armBack.position.set(-35, 42);
    this.armBack.pivot.set(-25, -8);
    this.armBack.addChild(
      new Graphics()
        .moveTo(-56, -7)
        .bezierCurveTo(-70, 14, -65, 41, -47, 53)
        .lineTo(42, 79)
        .bezierCurveTo(56, 83, 68, 70, 63, 56)
        .lineTo(55, 36)
        .bezierCurveTo(50, 24, 36, 17, 24, 20)
        .lineTo(-35, 34)
        .bezierCurveTo(-45, 17, -47, 2, -56, -7)
        .closePath()
        .fill(palette.paper)
        .stroke({ width: 4, color: palette.ink, join: 'round' }),
    );

    this.handBack.position.set(25, 37);
    this.handBack.addChild(this.makeHand(false));
    this.armBack.addChild(this.handBack);

    this.armFront.position.set(24, 66);
    this.armFront.pivot.set(10, 0);
    this.armFront.addChild(
      new Graphics()
        .moveTo(58, -13)
        .bezierCurveTo(69, 7, 66, 32, 47, 43)
        .lineTo(-50, 60)
        .bezierCurveTo(-66, 63, -77, 50, -72, 36)
        .lineTo(-65, 18)
        .bezierCurveTo(-60, 6, -45, -2, -31, 2)
        .lineTo(37, 19)
        .bezierCurveTo(43, 5, 48, -6, 58, -13)
        .closePath()
        .fill(palette.paper)
        .stroke({ width: 4, color: palette.ink, join: 'round' }),
    );

    this.handFront.position.set(-35, 11);
    this.handFront.addChild(this.makeHand(true));
    this.armFront.addChild(this.handFront);

    this.shoulders.addChild(this.armBack, this.armFront);

    const cuffBack = new Graphics()
      .moveTo(53, 47)
      .lineTo(66, 62)
      .stroke({ width: 3, color: palette.ink, alpha: 0.8, cap: 'round' });
    cuffBack.position.set(-36, 40);
    this.armBack.addChild(cuffBack);

    const cuffFront = new Graphics()
      .moveTo(-62, 33)
      .lineTo(-50, 52)
      .stroke({ width: 3, color: palette.ink, alpha: 0.8, cap: 'round' });
    cuffFront.position.set(18, 1);
    this.armFront.addChild(cuffFront);
  }

  private buildHead() {
    this.head.y = -56;
    this.character.addChild(this.head);

    this.neckScarf.position.set(2, 99);
    this.neckScarf.addChild(
      new Graphics()
        .moveTo(-29, -9)
        .bezierCurveTo(-25, 10, -16, 24, 0, 31)
        .bezierCurveTo(16, 24, 25, 10, 29, -9)
        .bezierCurveTo(15, -1, -15, -1, -29, -9)
        .closePath()
        .fill(palette.paper)
        .stroke({ width: 4, color: palette.ink, join: 'round' }),
      new Graphics()
        .moveTo(5, 22)
        .lineTo(27, 42)
        .bezierCurveTo(32, 48, 28, 53, 22, 49)
        .lineTo(3, 31)
        .closePath()
        .fill(palette.paper)
        .stroke({ width: 3, color: palette.ink, join: 'round' }),
    );
    this.head.addChild(this.neckScarf);

    const earLeft = new Graphics()
      .ellipse(-82, 6, 16, 22)
      .fill(palette.paper)
      .stroke({ width: 4, color: palette.ink });
    const earRight = new Graphics()
      .ellipse(82, 6, 16, 22)
      .fill(palette.paper)
      .stroke({ width: 4, color: palette.ink });
    const earDetailLeft = new Graphics()
      .moveTo(-84, 1)
      .bezierCurveTo(-76, -3, -75, 9, -82, 14)
      .stroke({ width: 2.5, color: palette.ink, alpha: 0.65, cap: 'round' });
    const earDetailRight = new Graphics()
      .moveTo(84, 1)
      .bezierCurveTo(76, -3, 75, 9, 82, 14)
      .stroke({ width: 2.5, color: palette.ink, alpha: 0.65, cap: 'round' });

    const face = new Graphics()
      .moveTo(-74, -38)
      .bezierCurveTo(-88, -5, -82, 47, -55, 75)
      .bezierCurveTo(-31, 101, 8, 107, 39, 91)
      .bezierCurveTo(72, 74, 88, 39, 80, -4)
      .bezierCurveTo(74, -39, 40, -66, 1, -69)
      .bezierCurveTo(-30, -72, -61, -61, -74, -38)
      .closePath()
      .fill(palette.paper)
      .stroke({ width: 4.5, color: palette.ink, join: 'round' });

    this.head.addChild(earLeft, earRight, earDetailLeft, earDetailRight, face);

    this.hair.addChild(
      new Graphics()
        .moveTo(-73, -29)
        .bezierCurveTo(-68, -70, -41, -94, -6, -95)
        .bezierCurveTo(27, -96, 59, -80, 76, -48)
        .bezierCurveTo(66, -55, 54, -57, 43, -54)
        .bezierCurveTo(30, -70, 10, -76, -10, -70)
        .bezierCurveTo(-25, -66, -34, -54, -40, -39)
        .bezierCurveTo(-51, -44, -64, -40, -73, -29)
        .closePath()
        .fill(palette.ink)
        .stroke({ width: 3, color: palette.paper, alpha: 0.82, join: 'round' }),
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
        .fill(palette.ink),
      new Graphics()
        .moveTo(13, -14)
        .bezierCurveTo(37, -15, 55, -3, 66, 15)
        .bezierCurveTo(50, 7, 37, 8, 22, 16)
        .bezierCurveTo(26, 2, 22, -7, 13, -14)
        .closePath()
        .fill(palette.ink),
    );
    this.head.addChild(this.fringe);

    this.eyeLeft = this.makeEye(-33, 1);
    this.eyeRight = this.makeEye(34, -1);
    this.head.addChild(this.eyeLeft.root, this.eyeRight.root);

    this.browLeft = new Graphics()
      .moveTo(-16, 0)
      .bezierCurveTo(-6, -4, 7, -4, 16, 0)
      .stroke({ width: 4, color: palette.ink, cap: 'round' });
    this.browLeft.position.set(-33, -31);

    this.browRight = new Graphics()
      .moveTo(-16, 0)
      .bezierCurveTo(-6, -4, 7, -4, 16, 0)
      .stroke({ width: 4, color: palette.ink, cap: 'round' });
    this.browRight.position.set(34, -31);
    this.head.addChild(this.browLeft, this.browRight);

    const nose = new Graphics()
      .moveTo(-3, 2)
      .bezierCurveTo(-7, 10, -7, 16, 1, 18)
      .bezierCurveTo(5, 19, 8, 17, 9, 14)
      .stroke({ width: 3.2, color: palette.ink, cap: 'round', join: 'round' });
    this.head.addChild(nose);

    this.cheekLeft
      .moveTo(-63, 31)
      .lineTo(-53, 29)
      .moveTo(-61, 37)
      .lineTo(-51, 35)
      .stroke({ width: 2, color: palette.ink, alpha: 0.3, cap: 'round' });
    this.cheekRight
      .moveTo(53, 29)
      .lineTo(63, 31)
      .moveTo(51, 35)
      .lineTo(61, 37)
      .stroke({ width: 2, color: palette.ink, alpha: 0.3, cap: 'round' });
    this.head.addChild(this.cheekLeft, this.cheekRight);

    this.mouth.y = 46;
    this.head.addChild(this.mouth);
  }

  private makeEye(x: number, direction: 1 | -1): EyeParts {
    const root = new Container();
    root.position.set(x, -4);

    const eye = new Graphics()
      .ellipse(0, 0, 10.5, 15)
      .fill(palette.ink);
    const pupil = new Graphics()
      .circle(direction * -1.5, -2.8, 2.6)
      .fill(palette.paper);

    root.addChild(eye, pupil);
    return { root, pupil };
  }

  private makeHand(front: boolean) {
    const hand = new Container();
    const direction = front ? -1 : 1;

    hand.addChild(
      new Graphics()
        .moveTo(-15 * direction, 4)
        .bezierCurveTo(-8 * direction, -5, 4 * direction, -7, 10 * direction, 1)
        .bezierCurveTo(17 * direction, 10, 15 * direction, 22, 6 * direction, 28)
        .bezierCurveTo(-2 * direction, 33, -13 * direction, 28, -17 * direction, 20)
        .bezierCurveTo(-21 * direction, 13, -20 * direction, 8, -15 * direction, 4)
        .closePath()
        .fill(palette.paper)
        .stroke({ width: 3.5, color: palette.ink, join: 'round' }),
      new Graphics()
        .moveTo(-7 * direction, 5)
        .bezierCurveTo(-2 * direction, -5, 3 * direction, -8, 7 * direction, 1)
        .moveTo(0, 4)
        .bezierCurveTo(4 * direction, -6, 9 * direction, -7, 11 * direction, 2)
        .moveTo(6 * direction, 7)
        .bezierCurveTo(10 * direction, -1, 14 * direction, 0, 14 * direction, 8)
        .stroke({ width: 2.4, color: palette.ink, cap: 'round' }),
    );

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
        .bezierCurveTo(
          -width * 0.18,
          5 - smileLift,
          width * 0.17,
          5 - smileLift,
          width * 0.52,
          -1,
        )
        .stroke({ width: 4, color: palette.ink, cap: 'round' });
      return;
    }

    const radius = Math.max(4, Math.min(height * 0.48, 13));
    this.mouth
      .roundRect(-width / 2, -height / 2 - smile * 1.5, width, height, radius)
      .fill(palette.ink);

    if (pose.open > 0.42) {
      this.mouth
        .roundRect(-width * 0.3, -height * 0.43 - smile * 1.5, width * 0.6, Math.max(2.5, height * 0.12), 3)
        .fill(palette.paper);
    }

    if (pose.open > 0.66 && pose.round < 0.68) {
      this.mouth
        .ellipse(0, height * 0.22 - smile * 1.5, width * 0.23, Math.max(2, height * 0.13))
        .fill({ color: palette.paperSoft, alpha: 0.9 });
    }
  }
}
