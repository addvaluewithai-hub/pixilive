const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export interface SpeechDynamics {
  energy: number;
  pitchHz: number;
  pitchNorm: number;
  pitchDelta: number;
  brightness: number;
  voiced: number;
  onset: number;
}

export interface TimedSpeechDynamics {
  offsetSeconds: number;
  dynamics: SpeechDynamics;
}

const estimatePitch = (frame: Float32Array, sampleRate: number) => {
  const minHz = 75;
  const maxHz = 420;
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(frame.length - 2, Math.ceil(sampleRate / minHz));

  let bestLag = 0;
  let best = 0;
  let zeroLag = 0;
  for (let index = 0; index < frame.length; index += 1) zeroLag += frame[index] * frame[index];
  if (zeroLag < 1e-6) return { hz: 0, confidence: 0 };

  for (let lag = minLag; lag <= maxLag; lag += 2) {
    let correlation = 0;
    for (let index = 0; index < frame.length - lag; index += 1) {
      correlation += frame[index] * frame[index + lag];
    }
    const normalized = correlation / zeroLag;
    if (normalized > best) {
      best = normalized;
      bestLag = lag;
    }
  }

  if (!bestLag || best < 0.16) return { hz: 0, confidence: clamp(best / 0.45) };
  return { hz: sampleRate / bestLag, confidence: clamp((best - 0.12) / 0.55) };
};

const analyzeFrame = (samples: Int16Array, sampleRate: number, previousEnergy: number, previousPitch: number): SpeechDynamics => {
  if (!samples.length) {
    return { energy: 0, pitchHz: 0, pitchNorm: 0.35, pitchDelta: 0, brightness: 0, voiced: 0, onset: 0 };
  }

  const frame = new Float32Array(samples.length);
  let sumSquares = 0;
  let diffSquares = 0;
  let previous = samples[0] / 32768;

  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] / 32768;
    frame[index] = value * (0.54 - 0.46 * Math.cos((2 * Math.PI * index) / Math.max(1, samples.length - 1)));
    sumSquares += value * value;
    const diff = value - previous;
    diffSquares += diff * diff;
    previous = value;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const energy = clamp((rms - 0.0035) * 9.4);
  const brightness = clamp(Math.sqrt(diffSquares / samples.length) / Math.max(rms, 0.008) * 0.72);
  const pitch = energy > 0.04 ? estimatePitch(frame, sampleRate) : { hz: 0, confidence: 0 };
  const pitchNorm = pitch.hz ? clamp((pitch.hz - 85) / 285) : previousPitch || 0.35;
  const pitchDelta = clamp((pitchNorm - previousPitch) * 2.2, -1, 1);
  const onset = clamp((energy - previousEnergy - 0.025) * 5.5);

  return {
    energy,
    pitchHz: pitch.hz,
    pitchNorm,
    pitchDelta,
    brightness,
    voiced: pitch.confidence,
    onset,
  };
};

/**
 * Lightweight playback-side prosody analysis. It does not attempt emotion
 * recognition; it exposes physical speech cues that the local performance brain
 * can combine with transcript meaning and conversation state.
 */
export class SpeechProsodyAnalyzer {
  private previousEnergy = 0;
  private previousPitch = 0.35;

  reset() {
    this.previousEnergy = 0;
    this.previousPitch = 0.35;
  }

  analyze(samples: Int16Array, sampleRate: number): TimedSpeechDynamics[] {
    const frameSize = Math.max(480, Math.round(sampleRate * 0.04));
    const hopSize = Math.max(360, Math.round(sampleRate * 0.03));
    const result: TimedSpeechDynamics[] = [];

    for (let start = 0; start < samples.length; start += hopSize) {
      const end = Math.min(samples.length, start + frameSize);
      const dynamics = analyzeFrame(samples.subarray(start, end), sampleRate, this.previousEnergy, this.previousPitch);
      this.previousEnergy = dynamics.energy;
      if (dynamics.pitchHz > 0) this.previousPitch = dynamics.pitchNorm;
      result.push({ offsetSeconds: start / sampleRate, dynamics });
    }

    return result;
  }
}
