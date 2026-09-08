import { Container, Graphics, type Ticker } from 'pixi.js';
import type { CharacterSignals, Emotion, MouthPose } from './types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const damp = (from: number, to: number, speed: number, dt: number) => lerp(from, to, 1 - Math.exp(-speed * dt));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

const palette = {
  shell: 0xb9a7ff,
  shellDark: 0x7468e9,
  aqua: 0x6de8f2,
  face: 0x171a36,
  white: 0xf9fbff,
  iris: 0x8bf3ff,
  pupil: 0x101226,
  blush: 0xff8fc8,
  mouth: 0x26142e,
  tongue: 0xff7aa9,
  glow: 0x9c8cff,
};

const moods: Record<Emotion, { smile: number; eye: number; brow: number; energy: number; tilt: number; cheek: number }> = {
  calm: { smile: 0.14, eye: 1, brow: 0, energy: 0.2, tilt: 0, cheek: 0.12 },
  happy: { smile: 0.72, eye: 0.88, brow: 0.045, energy: 0.58, tilt: -0.02, cheek: 0.34 },
  curious: { smile: 0.24, eye: 1.07, brow: 0.13, energy: 0.38, tilt: 0.045, cheek: 0.15 },
  excited: { smile: 0.72, eye: 1.08, brow: 0.075, energy: 0.9, tilt: -0.025, cheek: 0.42 },
};

interface EyeParts {
  root: Container;
  iris: Graphics;
  pupil: Graphics;
  shine: Graphics;
}

export class NovaCharacter {
  readonly view = new Container();

  private readonly character = new Container();
  private readonly body = new Container();
  private readonly head = new Container();
  private readonly tail = new Container();
  private readonly armLeft = new Container();
  private readonly armRight = new Container();
  private readonly earLeft: Container;
  private readonly earRight: Container;
  private readonly eyeLeft: EyeParts;
  private readonly eyeRight: EyeParts;
  private readonly browLeft: Graphics;
  private readonly browRight: Graphics;
  private readonly cheekLeft: Graphics;
  private readonly cheekRight: Graphics;
  private readonly mouth = new Graphics();
  private readonly shadow: Graphics;
  private readonly antenna = new Container();
  private readonly antennaGlow: Graphics;
  private readonly antennaOrb: Graphics;
  private readonly auras: Graphics[];

  private time = 0;
  private gaze = { x: 0, y: 0 };
  private gazeTarget = { x: 0, y: 0 };
  private blink = 1;
  private blinkTarget = 1;
  private nextBlink = 2;
  private reaction = 0;
  private signals: CharacterSignals = {
    emotion: 'calm',
    speaking: false,
    mouth: { open: 0.05, width: 0.35, round: 0.12, energy: 0 },
  };
  private renderedMouth: MouthPose = { ...this.signals.mouth };

  constructor() {
    this.view.addChild(this.character);
    this.character.sortableChildren = true;

    this.shadow = new Graphics().ellipse(0, 220, 128, 25).fill({ color: 0x000000, alpha: 0.26 });
    this.shadow.zIndex = 0;
    this.character.addChild(this.shadow);

    this.auras = [184, 151, 127].map((radius, index) =>
      new Graphics().circle(0, 4, radius).fill({ color: index === 1 ? palette.aqua : palette.glow, alpha: 0.02 + index * 0.006 }),
    );
    for (const aura of this.auras) aura.zIndex = -1;
    this.character.addChild(...this.auras);

    // Tail starts well inside the torso and is rendered behind it. This removes
    // the old cut-off attachment line while keeping a clear crescent silhouette.
    this.tail.position.set(66, 106);
    this.tail.zIndex = 1;
    this.tail.addChild(
      new Graphics()
        .moveTo(-16, 2)
        .bezierCurveTo(43, 5, 86, 53, 63, 96)
        .bezierCurveTo(53, 116, 28, 128, 8, 119)
        .bezierCurveTo(38, 91, 44, 55, 12, 34)
        .bezierCurveTo(1, 27, -9, 22, -16, 22)
        .closePath()
        .fill(palette.shellDark),
      new Graphics()
        .moveTo(9, 34)
        .bezierCurveTo(47, 50, 58, 76, 37, 101)
        .bezierCurveTo(55, 90, 57, 59, 18, 38)
        .closePath()
        .fill({ color: palette.aqua, alpha: 0.54 }),
    );
    this.character.addChild(this.tail);

    this.body.y = 112;
    this.body.zIndex = 2;
    const torso = new Graphics()
      .moveTo(-72, -34)
      .bezierCurveTo(-97, 22, -91, 119, -50, 155)
      .bezierCurveTo(-23, 177, 26, 177, 51, 154)
      .bezierCurveTo(92, 117, 97, 24, 72, -34)
      .bezierCurveTo(42, -6, -42, -6, -72, -34)
      .closePath()
      .fill(palette.shellDark);
    this.body.addChild(
      new Graphics().ellipse(0, 45, 100, 113).fill({ color: palette.shell, alpha: 0.09 }),
      torso,
      new Graphics().ellipse(0, 63, 61, 90).fill({ color: 0x4f4ec5, alpha: 0.4 }),
      new Graphics().circle(0, 72, 16).fill({ color: palette.face, alpha: 0.85 }).circle(0, 72, 9).fill(palette.aqua),
      new Graphics().circle(-3, 68, 3).fill({ color: palette.white, alpha: 0.8 }),
    );
    this.character.addChild(this.body);

    // Arms are siblings of body/head instead of body children. That gives the
    // performance rig explicit front/behind control for gestures such as think.
    this.makeArm(this.armLeft, -71, 104, 0.055);
    this.makeArm(this.armRight, 71, 104, -0.055);
    this.armLeft.zIndex = 3;
    this.armRight.zIndex = 3;
    this.character.addChild(this.armLeft, this.armRight);

    this.head.y = -35;
    this.head.zIndex = 4;
    this.earLeft = this.makeEar(-75, 1);
    this.earRight = this.makeEar(75, -1);
    this.head.addChild(this.earLeft, this.earRight);
    this.head.addChild(
      new Graphics().ellipse(0, 10, 112, 103).fill(palette.shellDark),
      new Graphics().ellipse(-25, -33, 64, 46).fill({ color: palette.shell, alpha: 0.46 }),
      new Graphics().ellipse(0, 13, 91, 76).fill(palette.face),
      new Graphics().ellipse(0, 16, 85, 69).stroke({ width: 2, color: palette.aqua, alpha: 0.11 }),
    );

    this.cheekLeft = new Graphics().ellipse(-58, 43, 18, 8).fill({ color: palette.blush, alpha: 0.14 });
    this.cheekRight = new Graphics().ellipse(58, 43, 18, 8).fill({ color: palette.blush, alpha: 0.14 });
    this.head.addChild(this.cheekLeft, this.cheekRight);

    this.eyeLeft = this.makeEye(-38);
    this.eyeRight = this.makeEye(38);
    this.head.addChild(this.eyeLeft.root, this.eyeRight.root);

    this.browLeft = new Graphics().roundRect(-19, -3, 38, 6, 3).fill(palette.shell);
    this.browLeft.position.set(-38, -42);
    this.browRight = new Graphics().roundRect(-19, -3, 38, 6, 3).fill(palette.shell);
    this.browRight.position.set(38, -42);
    this.head.addChild(this.browLeft, this.browRight);

    this.mouth.y = 53;
    this.head.addChild(this.mouth, new Graphics().circle(0, 31, 3).fill({ color: palette.aqua, alpha: 0.55 }));

    this.antenna.y = -93;
    this.antenna.addChild(new Graphics().roundRect(-3, -27, 6, 29, 3).fill(palette.shell));
    this.antennaGlow = new Graphics().circle(0, -31, 17).fill({ color: palette.aqua, alpha: 0.08 });
    this.antennaOrb = new Graphics().circle(0, -31, 7).fill(palette.aqua);
    this.antenna.addChild(
      this.antennaGlow,
      this.antennaOrb,
      new Graphics().circle(-2, -34, 2).fill({ color: palette.white, alpha: 0.85 }),
    );
    this.head.addChild(this.antenna);
    this.character.addChild(this.head);
    this.character.sortChildren();

    this.drawMouth(this.renderedMouth);
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
    this.signals.mouth = { open: 0.05, width: 0.35, round: 0.12, energy: 0 };
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

    this.gaze.x = damp(this.gaze.x, this.gazeTarget.x, 8, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeTarget.y, 8, dt);
    // Slightly slower parameter motion plus a topology-free mouth renderer below
    // removes the old visible snap between the closed line and open capsule.
    this.renderedMouth.open = damp(this.renderedMouth.open, this.signals.mouth.open, 17, dt);
    this.renderedMouth.width = damp(this.renderedMouth.width, this.signals.mouth.width, 13.5, dt);
    this.renderedMouth.round = damp(this.renderedMouth.round, this.signals.mouth.round, 14, dt);
    this.renderedMouth.energy = damp(this.renderedMouth.energy, this.signals.mouth.energy, 15, dt);
    this.reaction = damp(this.reaction, 0, 4.5, dt);

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkTarget = 0.04;
      this.nextBlink = 2.1 + Math.random() * 3.8;
      window.setTimeout(() => (this.blinkTarget = 1), 90 + Math.random() * 65);
    }
    this.blink = damp(this.blink, this.blinkTarget, 30, dt);

    const idle = Math.sin(this.time * 1.7);
    const breathe = (Math.sin(this.time * 2.1) + 1) * 0.5;
    const speechBob = this.renderedMouth.energy * Math.sin(this.time * 15) * 2.3;

    this.character.y = idle * 5 - this.reaction * 12 + speechBob;
    this.character.rotation = Math.sin(this.time * 0.75) * 0.012 + mood.tilt + this.gaze.x * 0.016 + this.reaction * 0.025;
    this.character.scale.set(1 + this.reaction * 0.025);
    this.shadow.scale.x = 1 - idle * 0.025 - this.reaction * 0.06;
    this.shadow.alpha = 0.25 - idle * 0.025;

    this.body.scale.y = 1 + breathe * 0.012;
    this.body.y = 112 + breathe * 1.3;
    this.armLeft.rotation = 0.055 + Math.sin(this.time * 1.25) * 0.022 + mood.energy * 0.02;
    this.armRight.rotation = -0.055 - Math.sin(this.time * 1.25) * 0.022 - mood.energy * 0.02;
    if (this.signals.emotion === 'excited') {
      this.armLeft.rotation = -0.16 + Math.sin(this.time * 7) * 0.055;
      this.armRight.rotation = 0.16 - Math.sin(this.time * 7) * 0.055;
    }

    // The tail base is hidden behind the torso; rotation + a lagging skew gives
    // it a soft two-stage follow-through without a second authored sprite.
    this.tail.rotation = 0.045 + Math.sin(this.time * 1.35) * 0.105 + this.reaction * 0.11;
    this.tail.skew.y = Math.sin(this.time * 1.35 - 0.72) * 0.055 + this.reaction * 0.025;
    this.tail.scale.y = 1 + Math.sin(this.time * 1.35 - 1.1) * 0.025;

    this.head.rotation = Math.sin(this.time * 0.92) * 0.016 + this.gaze.x * 0.025;
    this.head.y = -35 + Math.sin(this.time * 1.7 + 1) * 2.4 - this.reaction * 2;
    this.earLeft.rotation = -0.04 + Math.sin(this.time * 1.15) * 0.045 - this.reaction * 0.12 - mood.energy * 0.025;
    this.earRight.rotation = 0.04 - Math.sin(this.time * 1.15 + 0.4) * 0.045 + this.reaction * 0.12 + mood.energy * 0.025;
    this.antenna.rotation = Math.sin(this.time * 1.8) * 0.035 + this.reaction * 0.1;
    this.antennaGlow.scale.set(1 + 0.15 * Math.sin(this.time * 2.8) + this.renderedMouth.energy * 0.15);
    this.antennaOrb.alpha = 0.78 + 0.22 * Math.sin(this.time * 2.2);

    const eyeScale = mood.eye * this.blink;
    this.eyeLeft.root.scale.y = eyeScale;
    this.eyeRight.root.scale.y = eyeScale;
    const pupilX = this.gaze.x * 7;
    const pupilY = this.gaze.y * 5;
    for (const eye of [this.eyeLeft, this.eyeRight]) {
      eye.iris.position.set(pupilX, pupilY + 2);
      eye.pupil.position.set(pupilX, pupilY + 3);
      eye.shine.position.set(pupilX, pupilY);
    }

    this.browLeft.rotation = -mood.brow + this.gaze.y * 0.03;
    this.browRight.rotation = mood.brow - this.gaze.y * 0.03;
    this.browLeft.y = -42;
    this.browRight.y = this.signals.emotion === 'curious' ? -47 : -42;
    this.cheekLeft.alpha = this.cheekRight.alpha = mood.cheek + this.renderedMouth.energy * 0.08;
    this.drawMouth(this.renderedMouth, mood.smile);

    const pulse = 1 + Math.sin(this.time * 1.25) * 0.018 + this.reaction * 0.08;
    this.auras[0].scale.set(1 + (pulse - 1) * 2.5);
    this.auras[1].scale.set(1 + (pulse - 1) * 1.8);
    this.auras[2].scale.set(pulse);
  }

  private makeArm(arm: Container, x: number, y: number, rotation: number) {
    arm.position.set(x, y);
    arm.rotation = rotation;
    arm.addChild(
      new Graphics().roundRect(-13, -2, 27, 98, 14).fill(palette.shellDark),
      new Graphics().circle(0, 92, 16).fill(palette.shell),
    );
  }

  private makeEar(x: number, flip: 1 | -1) {
    const ear = new Container();
    ear.position.set(x, -83);
    ear.scale.x = flip;
    ear.addChild(
      new Graphics()
        .moveTo(0, 35)
        .bezierCurveTo(-46, 8, -50, -62, -15, -94)
        .bezierCurveTo(10, -55, 26, -1, 22, 36)
        .closePath()
        .fill(palette.shellDark),
      new Graphics()
        .moveTo(-3, 15)
        .bezierCurveTo(-25, -7, -27, -51, -13, -68)
        .bezierCurveTo(3, -39, 10, -4, 9, 19)
        .closePath()
        .fill({ color: palette.aqua, alpha: 0.5 }),
    );
    return ear;
  }

  private makeEye(x: number): EyeParts {
    const root = new Container();
    root.position.set(x, -1);
    const iris = new Graphics().circle(0, 2, 14).fill(palette.iris);
    const pupil = new Graphics().circle(0, 3, 8).fill(palette.pupil);
    const shine = new Graphics()
      .circle(-4, -2, 4)
      .fill({ color: palette.white, alpha: 0.96 })
      .circle(4, 5, 2)
      .fill({ color: palette.white, alpha: 0.55 });
    root.addChild(new Graphics().ellipse(0, 0, 27, 31).fill(palette.white), iris, pupil, shine);
    return { root, iris, pupil, shine };
  }

  private drawMouth(pose: MouthPose, smile = 0.14) {
    this.mouth.clear();
    const width = 25 + pose.width * 34 - pose.round * 8;
    const open = clamp(pose.open);
    const opening = smooth(clamp((open - 0.035) / 0.28));
    const height = 1.6 + open * 35 + pose.round * 8;
    const y = smile > 0 ? -smile * 2 : 0;

    // Closed smile fades out while the interior grows; there is no hard shape
    // switch anymore, so REST -> vowel transitions stay continuous.
    const lineAlpha = 0.92 * (1 - opening * 0.9);
    if (lineAlpha > 0.03) {
      this.mouth
        .moveTo(-width * 0.48, y)
        .bezierCurveTo(-width * 0.18, y + 4 - smile * 7, width * 0.18, y + 4 - smile * 7, width * 0.48, y)
        .stroke({ width: 4 - opening * 0.8, color: palette.blush, alpha: lineAlpha, cap: 'round' });
    }

    if (opening > 0.015) {
      const rx = width * 0.5;
      const ry = Math.max(1.2, height * 0.5 * opening);
      this.mouth
        .moveTo(-rx, y)
        .bezierCurveTo(-rx * 0.82, y - ry, rx * 0.82, y - ry, rx, y)
        .bezierCurveTo(rx * 0.82, y + ry, -rx * 0.82, y + ry, -rx, y)
        .closePath()
        .fill({ color: palette.mouth, alpha: 0.96 * opening });

      const tongueAlpha = smooth(clamp((open - 0.16) / 0.32));
      if (tongueAlpha > 0.02) {
        this.mouth.ellipse(0, y + ry * 0.48, width * 0.27, Math.max(1.5, ry * 0.42))
          .fill({ color: palette.tongue, alpha: 0.9 * tongueAlpha });
      }
      const teethAlpha = smooth(clamp((open - 0.46) / 0.25));
      if (teethAlpha > 0.02) {
        this.mouth.roundRect(-width * 0.28, y - ry * 0.82, width * 0.56, Math.max(2, ry * 0.22), 4)
          .fill({ color: palette.white, alpha: 0.9 * teethAlpha });
      }
    }
  }
}
