import type { MouthPose } from '../character/types';
import { VisemeAnalyzer } from './VisemeAnalyzer';

const base64ToInt16 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
};

export interface PlaybackClockSnapshot {
  nowSeconds: number;
  bufferedEndSeconds: number;
  turnStartSeconds: number;
}

export class PcmPlaybackQueue {
  private context: AudioContext | null = null;
  private nextStart = 0;
  private turnStart = 0;
  private active = new Set<AudioBufferSourceNode>();
  private poseTimers = new Set<number>();
  private cueTimers = new Set<number>();
  private enqueueChain: Promise<void> = Promise.resolve();
  private readonly analyzer = new VisemeAnalyzer();

  constructor(
    private readonly onMouthPose: (pose: MouthPose) => void,
    private readonly onIdle: () => void,
    private readonly onPlaybackStart?: (clock: PlaybackClockSnapshot) => void,
  ) {}

  pushTranscript(text: string) {
    this.analyzer.pushTranscript(text);
  }

  getClock(): PlaybackClockSnapshot | null {
    if (!this.context) return null;
    const nowSeconds = this.context.currentTime;
    return {
      nowSeconds,
      bufferedEndSeconds: Math.max(nowSeconds, this.nextStart),
      turnStartSeconds: this.turnStart || nowSeconds,
    };
  }

  hasPendingAudio() {
    if (!this.context) return false;
    return this.active.size > 0 || this.nextStart > this.context.currentTime + 0.015;
  }

  scheduleAt(audioTimeSeconds: number, callback: () => void) {
    if (!this.context) {
      callback();
      return;
    }

    const delayMs = Math.max(0, (audioTimeSeconds - this.context.currentTime) * 1000);
    const timer = window.setTimeout(() => {
      this.cueTimers.delete(timer);
      callback();
    }, delayMs);
    this.cueTimers.add(timer);
  }

  enqueue(base64: string, sampleRate = 24_000) {
    this.enqueueChain = this.enqueueChain.then(() => this.enqueueInternal(base64, sampleRate));
    return this.enqueueChain;
  }

  private async enqueueInternal(base64: string, sampleRate: number) {
    const samples = base64ToInt16(base64);
    const poses = this.analyzer.analyze(samples, sampleRate);
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
    const startingNewTurn = this.nextStart === 0;
    const startAt = Math.max(now + (startingNewTurn ? 0.075 : 0.012), this.nextStart);

    if (startingNewTurn) {
      this.turnStart = startAt;
      this.onPlaybackStart?.({
        nowSeconds: now,
        bufferedEndSeconds: startAt + buffer.duration,
        turnStartSeconds: startAt,
      });
    }

    for (const { offsetSeconds, pose } of poses) {
      const delayMs = Math.max(0, (startAt + offsetSeconds - now) * 1000);
      const timer = window.setTimeout(() => {
        this.poseTimers.delete(timer);
        this.onMouthPose(pose);
      }, delayMs);
      this.poseTimers.add(timer);
    }

    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    source.onended = () => {
      this.active.delete(source);
      if (this.active.size === 0) {
        this.nextStart = 0;
        this.turnStart = 0;
        this.analyzer.resetTranscript();
        this.onIdle();
      }
    };
  }

  interrupt() {
    for (const timer of this.poseTimers) window.clearTimeout(timer);
    this.poseTimers.clear();
    for (const timer of this.cueTimers) window.clearTimeout(timer);
    this.cueTimers.clear();
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.active.clear();
    this.nextStart = 0;
    this.turnStart = 0;
    this.enqueueChain = Promise.resolve();
    this.analyzer.resetTranscript();
    this.onIdle();
  }

  async close() {
    this.interrupt();
    await this.context?.close();
    this.context = null;
  }
}
