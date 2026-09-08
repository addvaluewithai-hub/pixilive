import type { Container, Ticker } from 'pixi.js';
import { CharacterDirector } from './CharacterDirector';
import { NovaCharacter } from './NovaCharacter';
import { NovaRig2D } from './NovaRig2D';
import type { CharacterAffect, CharacterMode, PerformanceCue, PerformanceState } from './performance';
import type { Emotion, MouthPose } from './types';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

interface NovaLayers {
  character: Container;
  body: Container;
  head: Container;
  tail: Container;
  armLeft: Container;
  armRight: Container;
  earLeft: Container;
  earRight: Container;
  antenna: Container;
  browLeft: { rotation: number; y: number };
  browRight: { rotation: number; y: number };
  eyeLeft: { root: Container };
  eyeRight: { root: Container };
}

/** Nova interprets shared semantic cues through creature-specific body language. */
export class DirectedNovaCharacter {
  readonly view: Container;
  private readonly base = new NovaCharacter();
  private readonly director = new CharacterDirector();
  private readonly layers: NovaLayers;
  readonly interaction: NovaRig2D;
  private userGaze = { x: 0, y: 0 };
  private time = 0;
  private affectAccent = 0;
  private lastAffect: CharacterAffect = 'neutral';
  private speechEnergy = 0;
  private smoothedSpeech = 0;

  constructor() {
    this.view = this.base.view;
    this.layers = this.base as unknown as NovaLayers;
    this.interaction = new NovaRig2D(this.layers.armLeft, this.layers.armRight);
  }

  setEmotion(emotion: Emotion) { this.base.setEmotion(emotion); }
  setMouth(pose: MouthPose, speaking = true) {
    this.speechEnergy = pose.energy;
    this.director.setSpeechEnergy(pose.energy);
    this.base.setMouth(pose, speaking);
  }
  settleMouth() {
    this.speechEnergy = 0;
    this.director.setSpeechEnergy(0);
    this.base.settleMouth();
  }
  lookAt(x: number, y: number) {
    this.userGaze = { x: clamp(x), y: clamp(y) };
  }
  react() {
    this.affectAccent = 1;
    this.base.react();
  }
  setMode(mode: CharacterMode) { this.director.setMode(mode); }
  perform(cue: PerformanceCue) {
    if (cue.affect !== this.lastAffect) {
      this.lastAffect = cue.affect;
      this.affectAccent = 1;
    }
    this.director.perform(cue);
  }
  setSpeechEnergy(energy: number) {
    this.speechEnergy = energy;
    this.director.setSpeechEnergy(energy);
  }
  interruptPerformance() {
    this.director.interrupt();
    this.affectAccent = Math.min(this.affectAccent, 0.25);
  }

  update(ticker: Ticker) {
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    this.time += dt;
    this.affectAccent = damp(this.affectAccent, 0, 4.5, dt);
    this.smoothedSpeech = damp(this.smoothedSpeech, this.speechEnergy, 9, dt);
    const state = this.director.update(dt);
    const gaze = this.resolveGaze(state);
    this.base.lookAt(gaze.x, gaze.y);
    this.base.update(ticker);
    // Base character owns idle art; the shared Rig2D adapter owns all physical
    // arm intent after base update so semantic gestures cannot be overwritten.
    this.interaction.update(state, dt);
    this.applyPerformance(state);
  }

  private resolveGaze(state: PerformanceState) {
    if (state.gaze === 'thinking_up' || (state.gaze === 'auto' && state.mode === 'thinking')) {
      return { x: state.gestureVariant % 2 ? -0.3 : 0.3, y: -0.55 };
    }
    if (state.gaze === 'thinking_side') return { x: state.gestureVariant % 2 ? -0.75 : 0.75, y: -0.1 };
    if (state.gaze === 'away') return { x: state.gestureVariant % 2 ? -0.9 : 0.9, y: 0.05 };
    return this.userGaze;
  }

  private applyPerformance(state: PerformanceState) {
    const w = state.intensity * 0.72 + 0.28;
    const envelope = state.gestureEnvelope * w;
    const speech = this.smoothedSpeech;
    const accent = this.affectAccent * w;
    this.layers.body.scale.x = 1;

    switch (state.affect) {
      case 'warm':
      case 'reassuring':
        this.layers.eyeLeft.root.scale.y *= 0.9;
        this.layers.eyeRight.root.scale.y *= 0.9;
        this.layers.earLeft.rotation -= 0.055 * w;
        this.layers.earRight.rotation += 0.055 * w;
        this.layers.tail.rotation += 0.025 * w;
        break;
      case 'curious':
        this.layers.eyeLeft.root.scale.y *= 1.05;
        this.layers.eyeRight.root.scale.y *= 1.02;
        this.layers.head.rotation += 0.055 * w;
        this.layers.browRight.y -= 4.2 * w;
        this.layers.earLeft.rotation -= 0.08 * w;
        this.layers.earRight.rotation += 0.02 * w;
        break;
      case 'thoughtful':
        this.layers.eyeLeft.root.scale.y *= 0.94;
        this.layers.eyeRight.root.scale.y *= 0.98;
        this.layers.head.rotation -= 0.042 * w;
        this.layers.browRight.y -= 3 * w;
        this.layers.antenna.rotation += 0.07 * w;
        this.layers.tail.rotation -= 0.055 * w;
        break;
      case 'enthusiastic':
        this.layers.character.y -= 3.2 * w;
        this.layers.eyeLeft.root.scale.y *= 1.08;
        this.layers.eyeRight.root.scale.y *= 1.08;
        this.layers.tail.rotation += 0.13 * w;
        this.layers.antenna.rotation += 0.065 * w;
        this.layers.earLeft.rotation -= 0.04 * w;
        this.layers.earRight.rotation += 0.04 * w;
        break;
      case 'concerned':
        this.layers.eyeLeft.root.scale.y *= 0.9;
        this.layers.eyeRight.root.scale.y *= 0.92;
        this.layers.earLeft.rotation += 0.095 * w;
        this.layers.earRight.rotation -= 0.095 * w;
        this.layers.head.rotation += 0.035 * w;
        this.layers.browLeft.rotation += 0.08 * w;
        this.layers.browRight.rotation -= 0.08 * w;
        break;
      case 'surprised':
        this.layers.eyeLeft.root.scale.y *= 1.2;
        this.layers.eyeRight.root.scale.y *= 1.2;
        this.layers.earLeft.rotation -= 0.14 * w;
        this.layers.earRight.rotation += 0.14 * w;
        this.layers.antenna.rotation += 0.1 * w;
        this.layers.character.y += 1.5 * w;
        break;
      case 'playful':
        this.layers.head.rotation -= 0.06 * w;
        this.layers.browRight.y -= 3.4 * w;
        this.layers.tail.rotation += 0.16 * w;
        this.layers.earRight.rotation += 0.055 * w;
        break;
      default:
        break;
    }

    if (accent > 0.02) {
      this.layers.character.y -= 2.2 * accent;
      this.layers.antenna.rotation += (state.gestureVariant % 2 ? -1 : 1) * 0.045 * accent;
      this.layers.tail.rotation += (state.gestureVariant % 2 ? 1 : -1) * 0.035 * accent;
    }

    if (state.mode === 'listening') {
      const earFocus = 0.025 + state.listeningBeat * 0.045;
      this.layers.earLeft.rotation -= earFocus;
      this.layers.earRight.rotation += earFocus;
      this.layers.head.y += state.listeningBeat * 1.4;
      this.layers.tail.rotation *= 0.98;
    } else if (state.mode === 'thinking') {
      this.layers.antenna.rotation += 0.075 + Math.sin(this.time * 1.7) * 0.012;
      this.layers.head.rotation += 0.02;
      this.layers.tail.rotation -= 0.025;
    } else if (state.mode === 'speaking') {
      const pulse = speech * (0.5 + 0.5 * Math.sin(this.time * 5.5) ** 2);
      this.layers.body.scale.y *= 1 + pulse * 0.004;
      this.layers.character.y -= pulse * 1.25;
      this.layers.tail.rotation += state.speechBeat * 0.065 + pulse * 0.025;
      this.layers.antenna.rotation += (state.gestureVariant % 2 ? -1 : 1) * state.speechBeat * 0.035;
    }

    // Arms are intentionally absent from this switch. NovaRig2D receives the
    // same PerformanceState and owns limb motion through shared constraints.
    switch (state.gesture) {
      case 'explain':
        this.layers.head.rotation += (state.gestureVariant % 2 ? 1 : -1) * 0.025 * envelope;
        this.layers.tail.rotation += 0.06 * envelope;
        break;
      case 'emphasize':
        this.layers.character.y -= 6.5 * envelope;
        this.layers.antenna.rotation += (state.gestureVariant % 2 ? -1 : 1) * 0.11 * envelope;
        this.layers.tail.rotation += 0.08 * envelope;
        break;
      case 'reassure':
        this.layers.earLeft.rotation -= 0.12 * envelope;
        this.layers.earRight.rotation += 0.12 * envelope;
        this.layers.head.rotation += 0.032 * envelope;
        break;
      case 'agree':
        this.layers.head.y += Math.sin(state.gesturePhase * Math.PI * 2) * 4 * envelope;
        break;
      case 'disagree':
        this.layers.head.rotation += Math.sin(state.gesturePhase * Math.PI * 2) * 0.075 * envelope;
        this.layers.earLeft.rotation += 0.035 * envelope;
        this.layers.earRight.rotation -= 0.035 * envelope;
        break;
      case 'think':
        this.layers.antenna.rotation += 0.15 * envelope;
        this.layers.tail.rotation -= 0.11 * envelope;
        this.layers.head.rotation -= 0.025 * envelope;
        break;
      case 'celebrate':
        this.layers.character.y -= 12 * envelope;
        this.layers.tail.rotation += 0.3 * envelope;
        this.layers.earLeft.rotation -= 0.08 * envelope;
        this.layers.earRight.rotation += 0.08 * envelope;
        break;
      case 'shrug':
        this.layers.earLeft.rotation += 0.1 * envelope;
        this.layers.earRight.rotation -= 0.1 * envelope;
        this.layers.head.y += 2 * envelope;
        break;
      case 'greet':
      case 'goodbye':
        this.layers.tail.rotation += 0.08 * envelope;
        break;
      default:
        break;
    }

    if (state.posture === 'lean_in' || state.posture === 'engaged') this.layers.character.scale.set(1 + 0.014 * w);
    if (state.posture === 'lean_back') this.layers.character.rotation += 0.018 * (state.gestureVariant % 2 ? -1 : 1) * w;
    if (state.posture === 'open') this.layers.body.scale.x = 1 + 0.018 * w;
  }
}
