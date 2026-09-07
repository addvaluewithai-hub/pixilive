import type { MouthPose } from '../character/types';

const base64ToInt16 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
};

const inferMouthPose = (samples: Int16Array): MouthPose => {
  if (samples.length === 0) return { open: 0.05, width: 0.35, round: 0.12, energy: 0 };
  let energy = 0;
  let zeroCrossings = 0;
  let previous = samples[0];
  for (const sample of samples) {
    const normalized = sample / 32768;
    energy += normalized * normalized;
    if ((sample >= 0) !== (previous >= 0)) zeroCrossings += 1;
    previous = sample;
  }
  const rms = Math.sqrt(energy / samples.length);
  const voice = Math.min(1, Math.max(0, (rms - 0.006) * 7));
  const brightness = Math.min(1, zeroCrossings / Math.max(1, samples.length * 0.22));
  return {
    open: 0.05 + voice * 0.82,
    width: Math.min(1, 0.3 + brightness * 0.42 + voice * 0.24),
    round: Math.min(1, 0.1 + (1 - brightness) * voice * 0.62),
    energy: voice,
  };
};

export class PcmPlaybackQueue {
  private context: AudioContext | null = null;
  private nextStart = 0;
  private active = new Set<AudioBufferSourceNode>();
  private poseTimers = new Set<number>();

  constructor(private readonly onMouthPose: (pose: MouthPose) => void, private readonly onIdle: () => void) {}

  async enqueue(base64: string, sampleRate = 24_000) {
    const samples = base64ToInt16(base64);
    const pose = inferMouthPose(samples);
    if (!this.context) this.context = new AudioContext({ sampleRate, latencyHint: 'interactive' });
    if (this.context.state === 'suspended') await this.context.resume();

    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.active.add(source);

    const now = this.context.currentTime;
    const startAt = Math.max(now + 0.015, this.nextStart);
    const poseDelayMs = Math.max(0, (startAt - now) * 1000);
    const timer = window.setTimeout(() => {
      this.poseTimers.delete(timer);
      this.onMouthPose(pose);
    }, poseDelayMs);
    this.poseTimers.add(timer);

    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    source.onended = () => {
      this.active.delete(source);
      if (this.active.size === 0) {
        this.nextStart = 0;
        this.onIdle();
      }
    };
  }

  interrupt() {
    for (const timer of this.poseTimers) window.clearTimeout(timer);
    this.poseTimers.clear();
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.active.clear();
    this.nextStart = 0;
    this.onIdle();
  }

  async close() {
    this.interrupt();
    await this.context?.close();
    this.context = null;
  }
}
