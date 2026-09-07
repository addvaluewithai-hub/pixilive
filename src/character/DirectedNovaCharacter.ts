import type { Container, Ticker } from 'pixi.js';
import { CharacterDirector } from './CharacterDirector';
import { NovaCharacter } from './NovaCharacter';
import type { CharacterMode, PerformanceCue, PerformanceState } from './performance';
import type { Emotion, MouthPose } from './types';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

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
  antennaGlow: { scale: { set(value: number): void } };
  browLeft: { rotation: number; y: number };
  browRight: { rotation: number; y: number };
  eyeLeft: { root: Container };
  eyeRight: { root: Container };
}

/** Nova interprets the same semantic cues through ears, tail, antenna and bounce. */
export class DirectedNovaCharacter {
  readonly view: Container;
  private readonly base = new NovaCharacter();
  private readonly director = new CharacterDirector();
  private readonly layers: NovaLayers;
  private userGaze = { x: 0, y: 0 };

  constructor() {
    this.view = this.base.view;
    this.layers = this.base as unknown as NovaLayers;
  }

  setEmotion(emotion: Emotion) { this.base.setEmotion(emotion); }
  setMouth(pose: MouthPose, speaking = true) {
    this.director.setSpeechEnergy(pose.energy);
    this.base.setMouth(pose, speaking);
  }
  settleMouth() {
    this.director.setSpeechEnergy(0);
    this.base.settleMouth();
  }
  lookAt(x: number, y: number) {
    this.userGaze = { x: clamp(x), y: clamp(y) };
  }
  react() { this.base.react(); }
  setMode(mode: CharacterMode) { this.director.setMode(mode); }
  perform(cue: PerformanceCue) { this.director.perform(cue); }
  setSpeechEnergy(energy: number) { this.director.setSpeechEnergy(energy); }
  interruptPerformance() { this.director.interrupt(); }

  update(ticker: Ticker) {
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    const state = this.director.update(dt);
    const gaze = this.resolveGaze(state);
    this.base.lookAt(gaze.x, gaze.y);
    this.base.update(ticker);
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
    const w = state.intensity * 0.7 + 0.3;
    const envelope = state.gestureEnvelope * w;

    switch (state.affect) {
      case 'warm':
      case 'reassuring':
        this.layers.eyeLeft.root.scale.y *= 0.94;
        this.layers.eyeRight.root.scale.y *= 0.94;
        this.layers.earLeft.rotation -= 0.035 * w;
        this.layers.earRight.rotation += 0.035 * w;
        break;
      case 'curious':
      case 'thoughtful':
        this.layers.head.rotation += 0.04 * w;
        this.layers.browRight.y -= 3 * w;
        break;
      case 'enthusiastic':
        this.layers.character.y -= 2 * w;
        this.layers.tail.rotation += 0.08 * w;
        this.layers.antenna.rotation += 0.04 * w;
        break;
      case 'concerned':
        this.layers.earLeft.rotation += 0.06 * w;
        this.layers.earRight.rotation -= 0.06 * w;
        this.layers.head.rotation += 0.025 * w;
        break;
      case 'surprised':
        this.layers.eyeLeft.root.scale.y *= 1.12;
        this.layers.eyeRight.root.scale.y *= 1.12;
        this.layers.earLeft.rotation -= 0.09 * w;
        this.layers.earRight.rotation += 0.09 * w;
        break;
      case 'playful':
        this.layers.head.rotation -= 0.045 * w;
        this.layers.tail.rotation += 0.11 * w;
        break;
      default:
        break;
    }

    if (state.mode === 'listening') {
      this.layers.head.y += state.listeningBeat * 2.4;
      this.layers.earLeft.rotation -= state.listeningBeat * 0.035;
      this.layers.earRight.rotation += state.listeningBeat * 0.035;
    } else if (state.mode === 'thinking') {
      this.layers.antenna.rotation += 0.055;
      this.layers.head.rotation += 0.018;
    } else if (state.mode === 'speaking') {
      this.layers.head.y -= state.speechBeat * 1.7;
      this.layers.tail.rotation += state.speechBeat * 0.05;
    }

    switch (state.gesture) {
      case 'explain':
        (state.gestureVariant % 2 ? this.layers.armLeft : this.layers.armRight).rotation += (state.gestureVariant % 2 ? -1 : 1) * 0.32 * envelope;
        this.layers.head.rotation += (state.gestureVariant % 2 ? 1 : -1) * 0.018 * envelope;
        break;
      case 'emphasize':
        this.layers.character.y -= 5 * envelope;
        this.layers.antenna.rotation += (state.gestureVariant % 2 ? -1 : 1) * 0.08 * envelope;
        break;
      case 'reassure':
        this.layers.earLeft.rotation -= 0.08 * envelope;
        this.layers.earRight.rotation += 0.08 * envelope;
        this.layers.head.rotation += 0.025 * envelope;
        break;
      case 'agree':
        this.layers.head.y += Math.sin(state.gesturePhase * Math.PI * 4) * 3 * envelope;
        break;
      case 'disagree':
        this.layers.head.rotation += Math.sin(state.gesturePhase * Math.PI * 4) * 0.065 * envelope;
        break;
      case 'think':
        this.layers.antenna.rotation += 0.12 * envelope;
        this.layers.tail.rotation -= 0.08 * envelope;
        break;
      case 'celebrate':
        this.layers.character.y -= 9 * envelope;
        this.layers.armLeft.rotation -= 0.32 * envelope;
        this.layers.armRight.rotation += 0.32 * envelope;
        this.layers.tail.rotation += 0.22 * envelope;
        break;
      case 'shrug':
        this.layers.armLeft.rotation -= 0.2 * envelope;
        this.layers.armRight.rotation += 0.2 * envelope;
        this.layers.earLeft.rotation += 0.07 * envelope;
        this.layers.earRight.rotation -= 0.07 * envelope;
        break;
      case 'greet':
      case 'goodbye':
        this.layers.armRight.rotation += 0.38 * envelope + Math.sin(state.gesturePhase * Math.PI * 8) * 0.08 * envelope;
        break;
      default:
        break;
    }

    if (state.posture === 'lean_in' || state.posture === 'engaged') this.layers.character.scale.set(1 + 0.012 * w);
    if (state.posture === 'lean_back') this.layers.character.rotation += 0.015 * (state.gestureVariant % 2 ? -1 : 1) * w;
    if (state.posture === 'open') this.layers.body.scale.x *= 1 + 0.012 * w;
  }
}
