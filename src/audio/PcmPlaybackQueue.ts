import type { MouthPose } from '../character/types';
import { SpeechProsodyAnalyzer, type SpeechDynamics } from './SpeechProsodyAnalyzer';
import { VisemeAnalyzer } from './VisemeAnalyzer';

const base64ToInt16 = (base64: string) => {
  const binary = atob(base64);
  const evenLength = binary.length - (binary.length % 2);
  if (evenLength < 2) return new Int16Array(0);
  const bytes = new Uint8Array(evenLength);
  for (let index = 0; index < evenLength; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
};

export interface PlaybackPerformanceCallbacks {
  onSpeechStart?: () => void;
  onSpeechDynamics?: (dynamics: SpeechDynamics) => void;
  onSpeechEnd?: () => void;
}

export class PcmPlaybackQueue {
  private context: AudioContext | null = null;
  private nextStart = 0;
  private active = new Set<AudioBufferSourceNode>();
  private timers = new Set<number>();
  private readonly analyzer = new VisemeAnalyzer();
  private readonly prosody = new SpeechProsodyAnalyzer();
  private outputActive = false;
  private turnCompletePending = false;
  private starvationTimer: number | null = null;

  constructor(
    private readonly onMouthPose: (pose: MouthPose) => void,
    private readonly onIdle: () => void,
    private readonly performance: PlaybackPerformanceCallbacks = {},
  ) {}

  pushTranscript(text: string) {
    this.analyzer.pushTranscript(text);
  }

  async enqueue(base64: string, sampleRate = 24_000) {
    this.clearStarvationTimer();
    const startingNewOutput = !this.outputActive;
    if (startingNewOutput) {
      this.prosody.reset();
      this.turnCompletePending = false;
    }

    const samples = base64ToInt16(base64);
    if (!samples.length) return;
    const poses = this.analyzer.analyze(samples, sampleRate);
    const dynamicsFrames = this.prosody.analyze(samples, sampleRate);
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
    const startAt = Math.max(now + (this.nextStart === 0 ? 0.075 : 0.012), this.nextStart);

    if (startingNewOutput) {
      this.outputActive = true;
      this.schedule(startAt, now, () => this.performance.onSpeechStart?.());
    }

    for (const { offsetSeconds, pose } of poses) {
      this.schedule(startAt + offsetSeconds, now, () => this.onMouthPose(pose));
    }
    for (const { offsetSeconds, dynamics } of dynamicsFrames) {
      this.schedule(startAt + offsetSeconds, now, () => this.performance.onSpeechDynamics?.(dynamics));
    }

    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    source.onended = () => {
      this.active.delete(source);
      if (this.active.size > 0) return;
      if (this.turnCompletePending) this.finishOutput();
      else {
        this.starvationTimer = window.setTimeout(() => {
          this.starvationTimer = null;
          if (this.active.size === 0 && this.outputActive) this.finishOutput();
        }, 900);
      }
    };
  }

  markTurnComplete() {
    this.turnCompletePending = true;
    if (this.outputActive && this.active.size === 0) this.finishOutput();
  }

  interrupt() {
    const hadPlayback = this.outputActive || this.active.size > 0;
    this.clearStarvationTimer();
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    for (const source of this.active) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.active.clear();
    this.nextStart = 0;
    this.outputActive = false;
    this.turnCompletePending = false;
    this.analyzer.resetTranscript();
    this.prosody.reset();
    this.onIdle();
    if (hadPlayback) this.performance.onSpeechEnd?.();
  }

  async close() {
    this.interrupt();
    await this.context?.close();
    this.context = null;
  }

  private finishOutput() {
    if (!this.outputActive) return;
    this.clearStarvationTimer();
    this.nextStart = 0;
    this.analyzer.resetTranscript();
    this.prosody.reset();
    this.outputActive = false;
    this.turnCompletePending = false;
    this.onIdle();
    this.performance.onSpeechEnd?.();
  }

  private clearStarvationTimer() {
    if (this.starvationTimer !== null) {
      window.clearTimeout(this.starvationTimer);
      this.starvationTimer = null;
    }
  }

  private schedule(at: number, now: number, callback: () => void) {
    const delayMs = Math.max(0, (at - now) * 1000);
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delayMs);
    this.timers.add(timer);
  }
}
