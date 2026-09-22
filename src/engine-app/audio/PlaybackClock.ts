import { VisemeAnalyzer } from './VisemeAnalyzer.ts';
import type { MouthFrame, Viseme } from '../core/types.ts';
interface Sample { at: number; end: number; pose: MouthFrame }
interface Segment { start: number; end: number }
/** PCM scheduling and visual sampling share AudioContext.currentTime. No pose timers. */
export class PlaybackClock {
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private segments: Segment[] = [];
  private frames: Sample[] = [];
  private analyzer = new VisemeAnalyzer();
  private end = 0;
  get now() { return this.context?.currentTime ?? 0; }
  get nextStart() { return Math.max(this.now + .075, this.end); }
  get queuedSeconds() { return Math.max(0, this.end - this.now); }
  async unlock() {
    this.context ??= new AudioContext({ latencyHint: 'interactive' });
    await this.context.resume();
  }
  enqueue(base64: string, sampleRate = 24000) {
    if (!this.context || this.context.state !== 'running') throw new Error('الصوت متوقف. ابدأ الجلسة من الزر مرة تانية.');
    const raw = atob(base64);
    if (raw.length % 2 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Invalid PCM frame');
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const samples = new Int16Array(raw.length / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true);
    if (!samples.length) return this.nextStart;
    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
    const start = this.nextStart;
    const end = start + buffer.duration;
    const analyzed = this.analyzer.analyze(samples, sampleRate);
    for (let i = 0; i < analyzed.length; i++) {
      const { offsetSeconds, pose } = analyzed[i];
      const viseme: Viseme = pose.viseme === 'CONS' ? 'S' : (pose.viseme ?? 'REST');
      this.frames.push({ at: start + offsetSeconds, end: Math.min(end, start + (analyzed[i + 1]?.offsetSeconds ?? buffer.duration)),
        pose: { viseme, energy: pose.energy, open: pose.open, width: pose.width, round: pose.round } });
    }
    const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.context.destination);
    this.sources.add(source); source.onended = () => { this.sources.delete(source); source.disconnect(); };
    this.segments.push({ start, end }); this.end = end; source.start(start);
    return start;
  }
  sample() {
    const now = this.now;
    while (this.frames.length && this.frames[0].end <= now) this.frames.shift();
    while (this.segments.length && this.segments[0].end <= now) this.segments.shift();
    const first = this.frames[0];
    return { now, mouth: first && first.at <= now ? first.pose : null,
      speaking: this.segments.some(s => s.start <= now && now < s.end), drained: this.segments.length === 0 };
  }
  interrupt() {
    for (const source of this.sources) { source.onended = null; try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } }
    this.sources.clear(); this.frames = []; this.segments = []; this.end = 0;
    this.analyzer = new VisemeAnalyzer();
  }
  async close() { this.interrupt(); const context = this.context; this.context = null; if (context && context.state !== 'closed') await context.close(); }
}
