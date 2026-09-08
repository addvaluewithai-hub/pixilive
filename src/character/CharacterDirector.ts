import {
  neutralPerformanceCue,
  normalizePerformanceCue,
  type CharacterGesture,
  type CharacterMode,
  type PerformanceCue,
  type PerformanceState,
} from './performance';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-speed * dt));

const gestureDuration: Record<CharacterGesture, number> = {
  none: 0.1,
  explain: 2.8,
  emphasize: 1.45,
  reassure: 2.8,
  agree: 1.35,
  disagree: 1.55,
  think: 3.0,
  celebrate: 2.45,
  shrug: 2.15,
  greet: 2.15,
  goodbye: 2.2,
};

/**
 * Turns semantic acting intent into an interruptible, locally-timed performance.
 * The model chooses meaning; this class chooses timing, variation and restraint.
 */
export class CharacterDirector {
  private mode: CharacterMode = 'idle';
  private cue: PerformanceCue = { ...neutralPerformanceCue };
  private cueAge = 999;
  private gesturePhase = 1;
  private gestureVariant = 0;
  private speechEnergy = 0;
  private smoothedEnergy = 0;
  private previousEnergy = 0;
  private speechBeat = 0;
  private listeningBeat = 0;
  private beatCooldown = 0;
  private listeningClock = 0;
  private recentGestures: CharacterGesture[] = [];

  setMode(mode: CharacterMode) {
    if (this.mode === mode) return;
    const interruptedSpeaking = this.mode === 'speaking' && mode === 'listening';
    this.mode = mode;
    this.listeningClock = 0;
    if (interruptedSpeaking) this.interrupt();
  }

  perform(input: Partial<PerformanceCue>) {
    const next = normalizePerformanceCue(input);
    const repeated = next.gesture !== 'none' && this.recentGestures.slice(-2).includes(next.gesture);

    // Never throw away an explicit model direction. Repetition is handled by
    // choosing another variant, not by silently turning the gesture into "none".
    this.cue = next;
    this.cueAge = 0;
    this.gesturePhase = 0;
    const variationJump = repeated ? 3 : 1 + Math.floor(Math.random() * 3);
    this.gestureVariant = (this.gestureVariant + variationJump) % 6;

    if (next.gesture !== 'none') {
      this.recentGestures.push(next.gesture);
      if (this.recentGestures.length > 6) this.recentGestures.shift();
    }
  }

  setSpeechEnergy(energy: number) {
    this.speechEnergy = clamp01(energy);
  }

  interrupt() {
    // Jump into the settle half of the gesture instead of snapping to rest.
    this.gesturePhase = Math.max(this.gesturePhase, 0.74);
    this.speechEnergy = 0;
  }

  reset() {
    this.mode = 'idle';
    this.cue = { ...neutralPerformanceCue };
    this.cueAge = 999;
    this.gesturePhase = 1;
    this.speechEnergy = 0;
    this.smoothedEnergy = 0;
    this.speechBeat = 0;
    this.listeningBeat = 0;
  }

  update(dt: number): PerformanceState {
    this.cueAge += dt;
    this.beatCooldown = Math.max(0, this.beatCooldown - dt);
    this.smoothedEnergy = damp(this.smoothedEnergy, this.speechEnergy, 11, dt);

    const rise = this.smoothedEnergy - this.previousEnergy;
    if (this.mode === 'speaking' && this.smoothedEnergy > 0.13 && rise > 0.018 && this.beatCooldown <= 0) {
      this.speechBeat = 1;
      this.beatCooldown = 0.32 + Math.random() * 0.18;
    }
    this.previousEnergy = this.smoothedEnergy;
    this.speechBeat = damp(this.speechBeat, 0, 7.8, dt);

    if (this.mode === 'listening') {
      this.listeningClock += dt;
      const nextBeatAt = 2.5 + this.gestureVariant * 0.2;
      if (this.listeningClock > nextBeatAt) {
        this.listeningBeat = 1;
        this.listeningClock = -Math.random() * 1.4;
        this.gestureVariant = (this.gestureVariant + 1) % 6;
      }
    } else {
      this.listeningClock = 0;
    }
    this.listeningBeat = damp(this.listeningBeat, 0, 3.2, dt);

    if (this.gesturePhase < 1) {
      const duration = gestureDuration[this.cue.gesture] || 1.5;
      this.gesturePhase = Math.min(1, this.gesturePhase + dt / duration);
    }

    // Affect can linger briefly after a gesture, then returns toward neutral locally.
    let cue = this.cue;
    if (this.cueAge > 8 && this.gesturePhase >= 1) {
      cue = {
        ...neutralPerformanceCue,
        intensity: damp(this.cue.intensity, neutralPerformanceCue.intensity, 1.1, dt),
      };
      if (this.cueAge > 10) this.cue = cue;
    }

    // Agree/disagree used to drive two rapid head oscillations. Expose a half-rate
    // visual phase for those gestures so the character performs one readable nod
    // or head sweep instead of shaking.
    const visualPhase = this.cue.gesture === 'agree' || this.cue.gesture === 'disagree'
      ? this.gesturePhase * 0.5
      : this.gesturePhase;

    return {
      ...cue,
      mode: this.mode,
      speechEnergy: this.smoothedEnergy,
      speechBeat: this.speechBeat,
      listeningBeat: this.listeningBeat,
      gesturePhase: visualPhase,
      gestureEnvelope: this.gestureEnvelope(this.gesturePhase),
      gestureVariant: this.gestureVariant,
    };
  }

  private gestureEnvelope(phase: number) {
    if (phase >= 1) return 0;
    // Small anticipation, quick travel, a long readable hold, then a soft settle.
    if (phase < 0.12) return (phase / 0.12) * 0.22;
    if (phase < 0.32) return 0.22 + ((phase - 0.12) / 0.2) * 0.78;
    if (phase < 0.74) return 1;
    const t = (phase - 0.74) / 0.26;
    return 1 - t * t * (3 - 2 * t);
  }
}
