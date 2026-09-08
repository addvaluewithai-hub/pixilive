import type { Container, Ticker } from 'pixi.js';
import { CharacterDirector } from './CharacterDirector';
import { NovaCharacter } from './NovaCharacter';
import { NovaFaceRig2D, type NovaFaceLayers } from './NovaFaceRig2D';
import { NovaRig2D } from './NovaRig2D';
import type { CharacterAffect, CharacterMode, PerformanceCue, PerformanceState } from './performance';
import type { Emotion, MouthPose } from './types';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

interface NovaLayers extends NovaFaceLayers {
  character: Container;
  body: Container;
  tail: Container;
  armLeft: Container;
  armRight: Container;
  earLeft: Container;
  earRight: Container;
  antenna: Container;
}

/** Nova interprets shared semantic cues through creature-specific body language. */
export class DirectedNovaCharacter {
  readonly view: Container;
  private readonly base = new NovaCharacter();
  private readonly director = new CharacterDirector();
  private readonly layers: NovaLayers;
  private readonly face: NovaFaceRig2D;
  readonly interaction: NovaRig2D;
  private userGaze = { x: 0, y: 0 };
  private time = 0;
  private affectAccent = 0;
  private lastAffect: CharacterAffect = 'neutral';
  private speechEnergy = 0;
  private smoothedSpeech = 0;
  private emotion: Emotion = 'calm';
  private speaking = false;

  constructor() {
    this.view = this.base.view;
    this.layers = this.base as unknown as NovaLayers;
    this.face = new NovaFaceRig2D(this.layers);
    this.interaction = new NovaRig2D(this.layers.armLeft, this.layers.armRight);
  }

  setEmotion(emotion: Emotion) {
    this.emotion = emotion;
    this.base.setEmotion(emotion);
  }

  setMouth(pose: MouthPose, speaking = true) {
    this.speaking = speaking;
    this.speechEnergy = pose.energy;
    this.director.setSpeechEnergy(pose.energy);
    this.base.setMouth(pose, speaking);
  }

  settleMouth() {
    this.speaking = false;
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

    // Base character restores idle art first. Shared physical rig owns limbs,
    // then creature body acting, then NovaFaceRig2D is the final authority on face.
    this.interaction.update(state, dt);
    this.applyPerformance(state);
    this.face.apply({
      emotion: this.emotion,
      cue: state,
      performanceWeight: state.affect === 'neutral' ? 0 : clamp(state.intensity, 0, 1),
      mode: state.mode,
      speaking: this.speaking,
      time: this.time,
      accent: this.affectAccent,
    });
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

    // Affect body language. Face semantics are handled separately by NovaFaceRig2D.
    switch (state.affect) {
      case 'warm':
      case 'reassuring':
        this.layers.earLeft.rotation -= 0.055 * w;
        this.layers.earRight.rotation += 0.055 * w;
        this.layers.tail.rotation += 0.025 * w;
        break;
      case 'curious':
        this.layers.earLeft.rotation -= 0.08 * w;
        this.layers.earRight.rotation += 0.02 * w;
        this.layers.antenna.rotation += 0.035 * w;
        break;
      case 'thoughtful':
        this.layers.antenna.rotation += 0.07 * w;
        this.layers.tail.rotation -= 0.055 * w;
        break;
      case 'enthusiastic':
        this.layers.character.y -= 3.2 * w;
        this.layers.tail.rotation += 0.13 * w;
        this.layers.antenna.rotation += 0.065 * w;
        this.layers.earLeft.rotation -= 0.04 * w;
        this.layers.earRight.rotation += 0.04 * w;
        break;
      case 'concerned':
        this.layers.earLeft.rotation += 0.095 * w;
        this.layers.earRight.rotation -= 0.095 * w;
        this.layers.tail.rotation -= 0.04 * w;
        break;
      case 'surprised':
        this.layers.earLeft.rotation -= 0.14 * w;
        this.layers.earRight.rotation += 0.14 * w;
        this.layers.antenna.rotation += 0.1 * w;
        this.layers.character.y += 1.5 * w;
        break;
      case 'playful':
        this.layers.tail.rotation += 0.16 * w;
        this.layers.earRight.rotation += 0.055 * w;
        this.layers.antenna.rotation -= 0.035 * w;
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
      this.layers.tail.rotation *= 0.98;
    } else if (state.mode === 'thinking') {
      this.layers.antenna.rotation += 0.075 + Math.sin(this.time * 1.7) * 0.012;
      this.layers.tail.rotation -= 0.025;
    } else if (state.mode === 'speaking') {
      const pulse = speech * (0.5 + 0.5 * Math.sin(this.time * 5.5) ** 2);
      this.layers.body.scale.y *= 1 + pulse * 0.004;
      this.layers.character.y -= pulse * 1.25;
      this.layers.tail.rotation += state.speechBeat * 0.05 + pulse * 0.02;
      this.layers.antenna.rotation += (state.gestureVariant % 2 ? -1 : 1) * state.speechBeat * 0.035;
    }

    switch (state.gesture) {
      case 'explain':
        this.layers.tail.rotation += 0.055 * envelope;
        break;
      case 'emphasize':
        this.layers.character.y -= 5.5 * envelope;
        this.layers.antenna.rotation += (state.gestureVariant % 2 ? -1 : 1) * 0.1 * envelope;
        this.layers.tail.rotation += 0.065 * envelope;
        break;
      case 'reassure':
        this.layers.earLeft.rotation -= 0.11 * envelope;
        this.layers.earRight.rotation += 0.11 * envelope;
        break;
      case 'agree':
        this.layers.head.y += Math.sin(state.gesturePhase * Math.PI * 2) * 3.2 * envelope;
        break;
      case 'disagree':
        this.layers.head.rotation += Math.sin(state.gesturePhase * Math.PI * 2) * 0.06 * envelope;
        this.layers.earLeft.rotation += 0.03 * envelope;
        this.layers.earRight.rotation -= 0.03 * envelope;
        break;
      case 'think':
        this.layers.antenna.rotation += 0.15 * envelope;
        this.layers.tail.rotation -= 0.1 * envelope;
        break;
      case 'celebrate':
        this.layers.character.y -= 10 * envelope;
        this.layers.tail.rotation += 0.24 * envelope;
        this.layers.earLeft.rotation -= 0.08 * envelope;
        this.layers.earRight.rotation += 0.08 * envelope;
        break;
      case 'shrug':
        this.layers.earLeft.rotation += 0.09 * envelope;
        this.layers.earRight.rotation -= 0.09 * envelope;
        break;
      case 'greet':
      case 'goodbye':
        this.layers.tail.rotation += 0.07 * envelope;
        break;
      default:
        break;
    }

    if (state.posture === 'lean_in' || state.posture === 'engaged') this.layers.character.scale.set(1 + 0.014 * w);
    if (state.posture === 'lean_back') this.layers.character.rotation += 0.018 * (state.gestureVariant % 2 ? -1 : 1) * w;
    if (state.posture === 'open') this.layers.body.scale.x = 1 + 0.018 * w;
  }
}
