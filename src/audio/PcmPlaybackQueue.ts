import type { MouthPose } from '../character/types';
import { VisemeAnalyzer } from './VisemeAnalyzer';

const base64ToInt16 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
};

export class PcmPlaybackQueue {
  private context: AudioContext | null = null;
  private nextStart = 0;
  private active = new Set<AudioBufferSourceNode>();
  private poseTimers = new Set<number>();
  private readonly analyzer = new VisemeAnalyzer();
  private turnCompletePending = false;

  constructor(private readonly onMouthPose: (pose: MouthPose) => void, private readonly onIdle: () => void) {}

  pushTranscript(text: string) {
    this.analyzer.pushTranscript(text);
  }

  finishTurn() {
    this.turnCompletePending = true;
    if (this.active.size === 0) this.finishVisualTurn();
  }

  async enqueue(base64: string, sampleRate = 24_000) {
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
    this.turnCompletePending = false;

    const now = this.context.currentTime;
    // A small look-ahead gives the viseme analyzer and output transcription a chance
    // to stay in front of playback without making the conversation feel sluggish.
    const startAt = Math.max(now + (this.nextStart === 0 ? 0.075 : 0.012), this.nextStart);

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
        this.onIdle();
        if (this.turnCompletePending) this.finishVisualTurn();
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
    this.turnCompletePending = false;
    this.analyzer.resetTranscript();
    this.onIdle();
  }

  async close() {
    this.interrupt();
    await this.context?.close();
    this.context = null;
  }

  private finishVisualTurn() {
    this.turnCompletePending = false;
    this.analyzer.resetTranscript();
    this.onIdle();
  }
}
