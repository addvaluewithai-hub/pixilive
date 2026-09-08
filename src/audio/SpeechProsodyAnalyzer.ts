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
  for (let lag = minLag; lag <= maxLag; lag += 2) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let index = 0; index < frame.length - lag; index += 1) {
      const a = frame[index];
      const b = frame[index + lag];
      xy += a * b;
      xx += a * a;
      yy += b * b;
    }
    const correlation = xy / Math.max(1e-8, Math.sqrt(xx * yy));
    if (correlation > best) {
      best = correlation;
      bestLag = lag;
    }
  }

  if (!bestLag || best < 0.28) return { hz: 0, confidence: clamp((best - 0.12) / 0.28) };
  return {
    hz: sampleRate / bestLag,
    confidence: clamp((best - 0.24) / 0.5),
  };
};

const energyFromRms = (rms: number) => {
  if (rms <= 1e-5) return 0;
  const db = 20 * Math.log10(rms);
  // Approximately -52 dBFS → silence and -10 dBFS → full expressive energy.
  return clamp((db + 52) / 42);
};

const analyzeFrame = (samples: Int16Array, sampleRate: number, previousEnergy: number, previousPitch: number): SpeechDynamics => {
  if (!samples.length) {
    return { energy: 0, pitchHz: 0, pitchNorm: 0, pitchDelta: 0, brightness: 0, voiced: 0, onset: 0 };
  }

  const frame = new Float32Array(samples.length);
  let sumSquares = 0;
  let diffSquares = 0;
  let previous = samples[0] / 32768;

  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] / 32768;
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * index) / Math.max(1, samples.length - 1));
    frame[index] = value * window;
    sumSquares += value * value;
    const diff = value - previous;
    diffSquares += diff * diff;
    previous = value;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const energy = energyFromRms(rms);
  const brightness = clamp(Math.sqrt(diffSquares / samples.length) / Math.max(rms, 0.008) * 0.4);
  const pitch = energy > 0.13 ? estimatePitch(frame, sampleRate) : { hz: 0, confidence: 0 };
  const voiced = pitch.confidence >= 0.28 ? pitch.confidence : 0;
  const pitchHz = voiced > 0 ? pitch.hz : 0;
  const pitchNorm = pitchHz > 0 ? clamp((pitchHz - 85) / 285) : 0;
  const pitchDelta = pitchHz > 0 && previousPitch > 0 ? clamp((pitchNorm - previousPitch) * 2.2, -1, 1) : 0;
  const onset = clamp((energy - previousEnergy - 0.06) * 3.8);

  return { energy, pitchHz, pitchNorm, pitchDelta, brightness, voiced, onset };
};

/** Playback-synchronous physical speech analysis. No emotion labels are inferred here. */
export class SpeechProsodyAnalyzer {
  private previousEnergy = 0;
  private previousPitch = 0;

  reset() {
    this.previousEnergy = 0;
    this.previousPitch = 0;
  }

  analyze(samples: Int16Array, sampleRate: number): TimedSpeechDynamics[] {
    const frameSize = Math.max(480, Math.round(sampleRate * 0.04));
    const hopSize = Math.max(360, Math.round(sampleRate * 0.03));
    const result: TimedSpeechDynamics[] = [];

    for (let start = 0; start < samples.length; start += hopSize) {
      const end = Math.min(samples.length, start + frameSize);
      const dynamics = analyzeFrame(samples.subarray(start, end), sampleRate, this.previousEnergy, this.previousPitch);
      this.previousEnergy = dynamics.energy;
      if (dynamics.pitchHz > 0 && dynamics.voiced > 0.28) this.previousPitch = dynamics.pitchNorm;
      result.push({ offsetSeconds: start / sampleRate, dynamics });
    }

    return result;
  }
}
