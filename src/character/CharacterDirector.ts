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
  explain: 2.5,
  emphasize: 1.25,
  reassure: 2.4,
  agree: 1.15,
  disagree: 1.35,
  think: 2.7,
  celebrate: 2.1,
  shrug: 1.85,
  greet: 1.9,
  goodbye: 2.0,
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

    // Avoid a model accidentally turning Milo into a repetitive gesture machine.
    if (next.gesture !== 'none' && this.recentGestures.slice(-2).includes(next.gesture)) {
      next.gesture = Math.random() < 0.7 ? 'none' : next.gesture;
    }

    this.cue = next;
    this.cueAge = 0;
    this.gesturePhase = 0;
    this.gestureVariant = (this.gestureVariant + 1 + Math.floor(Math.random() * 3)) % 6;
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
    this.gesturePhase = Math.max(this.gesturePhase, 0.72);
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
    this.smoothedEnergy = damp(this.smoothedEnergy, this.speechEnergy, 13, dt);

    const rise = this.smoothedEnergy - this.previousEnergy;
    if (this.mode === 'speaking' && this.smoothedEnergy > 0.19 && rise > 0.045 && this.beatCooldown <= 0) {
      this.speechBeat = 1;
      this.beatCooldown = 0.2 + Math.random() * 0.12;
    }
    this.previousEnergy = this.smoothedEnergy;
    this.speechBeat = damp(this.speechBeat, 0, 9.5, dt);

    if (this.mode === 'listening') {
      this.listeningClock += dt;
      const nextBeatAt = 2.2 + this.gestureVariant * 0.18;
      if (this.listeningClock > nextBeatAt) {
        this.listeningBeat = 1;
        this.listeningClock = -Math.random() * 1.2;
        this.gestureVariant = (this.gestureVariant + 1) % 6;
      }
    } else {
      this.listeningClock = 0;
    }
    this.listeningBeat = damp(this.listeningBeat, 0, 3.7, dt);

    if (this.gesturePhase < 1) {
      const duration = gestureDuration[this.cue.gesture] || 1.5;
      this.gesturePhase = Math.min(1, this.gesturePhase + dt / duration);
    }

    // Affect can linger briefly after a gesture, then returns toward neutral locally.
    let cue = this.cue;
    if (this.cueAge > 7 && this.gesturePhase >= 1) {
      cue = {
        ...neutralPerformanceCue,
        intensity: damp(this.cue.intensity, neutralPerformanceCue.intensity, 1.2, dt),
      };
      if (this.cueAge > 9) this.cue = cue;
    }

    return {
      ...cue,
      mode: this.mode,
      speechEnergy: this.smoothedEnergy,
      speechBeat: this.speechBeat,
      listeningBeat: this.listeningBeat,
      gesturePhase: this.gesturePhase,
      gestureEnvelope: this.gestureEnvelope(this.gesturePhase),
      gestureVariant: this.gestureVariant,
    };
  }

  private gestureEnvelope(phase: number) {
    if (phase >= 1) return 0;
    // Fast anticipation, readable action, soft settle. Always interruptible.
    if (phase < 0.16) return phase / 0.16 * 0.34;
    if (phase < 0.38) return 0.34 + ((phase - 0.16) / 0.22) * 0.66;
    if (phase < 0.67) return 1;
    const t = (phase - 0.67) / 0.33;
    return 1 - t * t * (3 - 2 * t);
  }
}
