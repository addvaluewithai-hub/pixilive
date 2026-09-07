import type { MouthPose, Viseme } from '../character/types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface TimedMouthPose {
  offsetSeconds: number;
  pose: MouthPose;
}

const basePose = (viseme: Viseme, energy: number): MouthPose => {
  const voice = clamp(energy);
  switch (viseme) {
    case 'MBP':
      return { open: 0.01, width: 0.4, round: 0.03, energy: voice, viseme, lipPress: 1, teeth: 0, tongue: 0, cornerPull: 0.04 };
    case 'FV':
      return { open: 0.16, width: 0.55, round: 0.02, energy: voice, viseme, lowerLipBite: 0.92, teeth: 0.78, tongue: 0, cornerPull: 0.2 };
    case 'EE':
      return { open: 0.2 + voice * 0.14, width: 0.88, round: 0.01, energy: voice, viseme, teeth: 0.5, tongue: 0.04, cornerPull: 0.8 };
    case 'AA':
      return { open: 0.5 + voice * 0.37, width: 0.67, round: 0.08, energy: voice, viseme, teeth: 0.18, tongue: 0.42, cornerPull: 0.28 };
    case 'OH':
      return { open: 0.5 + voice * 0.25, width: 0.42, round: 0.74, energy: voice, viseme, teeth: 0.1, tongue: 0.18, cornerPull: 0.05 };
    case 'OO':
      return { open: 0.31 + voice * 0.17, width: 0.29, round: 0.98, energy: voice, viseme, teeth: 0.03, tongue: 0.04, cornerPull: 0 };
    case 'L':
      return { open: 0.3 + voice * 0.18, width: 0.61, round: 0.04, energy: voice, viseme, teeth: 0.34, tongue: 0.86, cornerPull: 0.32 };
    case 'CONS':
      return { open: 0.12 + voice * 0.2, width: 0.55, round: 0.06, energy: voice, viseme, teeth: 0.24, tongue: 0.08, cornerPull: 0.24 };
    case 'REST':
    default:
      return { open: 0.035, width: 0.4, round: 0.06, energy: voice, viseme: 'REST', lipPress: 0.08, teeth: 0, tongue: 0, cornerPull: 0.1 };
  }
};

const mixPose = (audio: MouthPose, hint: MouthPose, amount: number): MouthPose => ({
  open: lerp(audio.open, hint.open, amount),
  width: lerp(audio.width, hint.width, amount),
  round: lerp(audio.round, hint.round, amount),
  energy: audio.energy,
  viseme: amount >= 0.4 ? hint.viseme : audio.viseme,
  lipPress: lerp(audio.lipPress ?? 0, hint.lipPress ?? 0, amount),
  lowerLipBite: lerp(audio.lowerLipBite ?? 0, hint.lowerLipBite ?? 0, amount),
  teeth: lerp(audio.teeth ?? 0, hint.teeth ?? 0, amount),
  tongue: lerp(audio.tongue ?? 0, hint.tongue ?? 0, amount),
  cornerPull: lerp(audio.cornerPull ?? 0, hint.cornerPull ?? 0, amount),
});

const textToVisemes = (input: string): Viseme[] => {
  const normalized = input.toLowerCase();
  const result: Viseme[] = [];
  let index = 0;

  while (index < normalized.length) {
    const pair = normalized.slice(index, index + 2);
    const char = normalized[index];

    if (/\s|[.,!?;:()[\]{}"'،؛؟]/u.test(char)) {
      index += 1;
      continue;
    }

    if (pair === 'sh' || pair === 'ch' || pair === 'th' || pair === 'zh') {
      result.push('CONS');
      index += 2;
      continue;
    }
    if (pair === 'oo' || pair === 'ou') {
      result.push('OO');
      index += 2;
      continue;
    }
    if (pair === 'ee' || pair === 'ea') {
      result.push('EE');
      index += 2;
      continue;
    }

    if (/[bmpبم]/u.test(char)) result.push('MBP');
    else if (/[fvفڤ]/u.test(char)) result.push('FV');
    else if (/[iyieىي]/u.test(char)) result.push('EE');
    else if (/[uwو]/u.test(char)) result.push('OO');
    else if (/[oؤ]/u.test(char)) result.push('OH');
    else if (/[aáàâäeأإآاوعحه]/u.test(char)) result.push('AA');
    else if (/[lل]/u.test(char)) result.push('L');
    else if (/[sztdkgqrnxjcثتدذرسزشصضطظجكقخغن]/u.test(char)) result.push('CONS');
    else if (/\p{L}/u.test(char)) result.push('CONS');

    index += 1;
  }

  return result;
};

class TranscriptGuide {
  private queue: Viseme[] = [];
  private transcript = '';
  private tokenElapsed = 0;

  push(text: string) {
    const incoming = text.trim();
    if (!incoming) return;

    let delta = incoming;
    if (incoming.startsWith(this.transcript)) {
      delta = incoming.slice(this.transcript.length);
      this.transcript = incoming;
    } else if (this.transcript.endsWith(incoming)) {
      return;
    } else {
      let overlap = 0;
      const max = Math.min(this.transcript.length, incoming.length);
      for (let length = max; length > 0; length -= 1) {
        if (this.transcript.slice(-length) === incoming.slice(0, length)) {
          overlap = length;
          break;
        }
      }
      delta = incoming.slice(overlap);
      this.transcript += delta;
    }

    this.queue.push(...textToVisemes(delta));
    if (this.queue.length > 48) this.queue.splice(0, this.queue.length - 48);
  }

  next(deltaSeconds: number, energy: number) {
    if (this.queue.length === 0) return null;
    const current = this.queue[0];
    const hold = current === 'MBP' || current === 'FV' || current === 'CONS' ? 0.055 : 0.075;

    if (energy > 0.025 || current === 'MBP') {
      this.tokenElapsed += deltaSeconds;
      if (this.tokenElapsed >= hold) {
        this.queue.shift();
        this.tokenElapsed = 0;
      }
    }
    return current;
  }

  reset() {
    this.queue = [];
    this.transcript = '';
    this.tokenElapsed = 0;
  }
}

const goertzelPower = (samples: Float32Array, sampleRate: number, frequency: number) => {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coefficient = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let index = 0; index < samples.length; index += 1) {
    s0 = samples[index] + coefficient * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coefficient * s1 * s2);
};

const analyzeFrame = (samples: Int16Array, sampleRate: number): MouthPose => {
  if (samples.length === 0) return basePose('REST', 0);

  const windowed = new Float32Array(samples.length);
  let sumSquares = 0;
  let zeroCrossings = 0;
  let previous = samples[0];
  let previousNormalized = previous / 32768;

  for (let index = 0; index < samples.length; index += 1) {
    const normalized = samples[index] / 32768;
    sumSquares += normalized * normalized;
    if ((samples[index] >= 0) !== (previous >= 0)) zeroCrossings += 1;
    previous = samples[index];
    const preEmphasized = normalized - 0.94 * previousNormalized;
    previousNormalized = normalized;
    const hamming = 0.54 - 0.46 * Math.cos((2 * Math.PI * index) / Math.max(1, samples.length - 1));
    windowed[index] = preEmphasized * hamming;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const energy = clamp((rms - 0.0045) * 8.8);
  if (energy < 0.035) return basePose('REST', energy);

  const zcr = zeroCrossings / samples.length;
  const frequencies: number[] = [];
  for (let frequency = 250; frequency <= 3250; frequency += 150) frequencies.push(frequency);
  const powers = frequencies.map((frequency) => goertzelPower(windowed, sampleRate, frequency));

  const smoothed = powers.map((power, index) => {
    const left = powers[index - 1] ?? power;
    const right = powers[index + 1] ?? power;
    return left * 0.25 + power * 0.5 + right * 0.25;
  });

  let f1 = 500;
  let f1Power = -1;
  let f2 = 1500;
  let f2Power = -1;
  let spectralTotal = 0;
  let weightedFrequency = 0;

  for (let index = 0; index < frequencies.length; index += 1) {
    const frequency = frequencies[index];
    const power = smoothed[index];
    spectralTotal += power;
    weightedFrequency += power * frequency;
    if (frequency <= 1000 && power > f1Power) {
      f1Power = power;
      f1 = frequency;
    }
  }

  for (let index = 0; index < frequencies.length; index += 1) {
    const frequency = frequencies[index];
    const power = smoothed[index];
    if (frequency >= Math.max(850, f1 + 300) && power > f2Power) {
      f2Power = power;
      f2 = frequency;
    }
  }

  const centroid = spectralTotal > 0 ? weightedFrequency / spectralTotal : 1200;
  const highNoise = clamp((centroid - 1350) / 1500) * clamp((zcr - 0.05) / 0.2);

  let viseme: Viseme;
  if (highNoise > 0.34 && energy < 0.72) viseme = centroid < 2050 ? 'FV' : 'CONS';
  else if (f1 < 475 && f2 > 1700) viseme = 'EE';
  else if (f1 < 475 && f2 < 1250) viseme = 'OO';
  else if (f1 >= 700) viseme = 'AA';
  else if (f2 < 1350) viseme = 'OH';
  else viseme = 'AA';

  const pose = basePose(viseme, energy);
  pose.open = clamp(pose.open * (0.72 + energy * 0.38));
  return pose;
};

export class VisemeAnalyzer {
  private readonly transcript = new TranscriptGuide();

  pushTranscript(text: string) {
    this.transcript.push(text);
  }

  resetTranscript() {
    this.transcript.reset();
  }

  analyze(samples: Int16Array, sampleRate: number): TimedMouthPose[] {
    const frameSize = Math.max(160, Math.round(sampleRate * 0.024));
    const hopSize = Math.max(120, Math.round(sampleRate * 0.02));
    const frames: TimedMouthPose[] = [];

    if (samples.length <= frameSize) {
      const audio = analyzeFrame(samples, sampleRate);
      const hintViseme = this.transcript.next(samples.length / sampleRate, audio.energy);
      const hint = hintViseme ? basePose(hintViseme, audio.energy) : null;
      frames.push({ offsetSeconds: 0, pose: hint ? mixPose(audio, hint, 0.34) : audio });
      return frames;
    }

    for (let start = 0; start < samples.length; start += hopSize) {
      const end = Math.min(samples.length, start + frameSize);
      const frame = samples.subarray(start, end);
      const audio = analyzeFrame(frame, sampleRate);
      const hintViseme = this.transcript.next(hopSize / sampleRate, audio.energy);
      const hint = hintViseme ? basePose(hintViseme, audio.energy) : null;
      const hintWeight = hintViseme === 'MBP' || hintViseme === 'FV' ? 0.46 : 0.3;
      frames.push({
        offsetSeconds: start / sampleRate,
        pose: hint ? mixPose(audio, hint, hintWeight) : audio,
      });
    }

    return frames;
  }
}
