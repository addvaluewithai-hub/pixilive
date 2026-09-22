import { PlaybackClock } from '../audio/PlaybackClock.ts';
import { Microphone } from '../audio/Microphone.ts';
import { GeminiAdapter } from '../live/GeminiAdapter.ts';
import { PerformanceDirector } from './PerformanceDirector.ts';
import type { CharacterPort, Cue, Expression, Gesture, Mode, MouthFrame } from './types.ts';
export interface SessionView { connection: 'offline' | 'connecting' | 'connected'; mode: Mode; error: string; user: string; assistant: string; demo: boolean; energy: number }
const initial: SessionView = { connection: 'offline', mode: 'idle', error: '', user: '', assistant: '', demo: false, energy: 0 };
export class SessionController {
  readonly director = new PerformanceDirector();
  private playback = new PlaybackClock();
  private microphone = new Microphone();
  private live: GeminiAdapter;
  private view: SessionView = { ...initial };
  private publish: (view: SessionView) => void;
  private turn = 0;
  private pending: { id: string; cue: Cue }[] = [];
  private complete = true;
  private ignored = false;
  private operation = 0;
  private frame = 0;
  private lastPublish = 0;
  private demoStart: number | null = null;
  private lastRole = '';
  constructor(publish: (view: SessionView) => void) {
    this.publish = publish;
    this.live = new GeminiAdapter({
      status: connection => {
        this.view.connection = connection;
        if (connection === 'connected') this.director.mode('listening');
        if (connection === 'offline' && !this.view.demo) { void this.microphone.stop(); this.playback.interrupt(); this.director.interrupt(); this.director.mode('idle'); }
        this.emit();
      },
      turn: id => { this.turn = id; this.pending = []; this.complete = false; this.view.assistant = ''; if (!this.ignored) this.director.beginTurn(id); },
      audio: (data, rate) => {
        if (this.ignored) return;
        const start = this.playback.enqueue(data, rate);
        // Best-effort next-audio boundary, not a claimed word-level timestamp.
        for (const { id, cue } of this.pending) this.director.enqueue({ ...cue, id, turn: this.turn, at: start });
        this.pending = [];
      },
      cue: (id, cue) => { if (!this.ignored) { this.pending.push({ id, cue }); if (this.pending.length > 16) this.pending.shift(); } },
      cancel: ids => { this.pending = this.pending.filter(c => !ids.includes(c.id)); this.director.cancelCalls(ids); },
      transcript: (role, text) => {
        if (role === 'assistant' && this.ignored) return;
        if (role === 'user') this.view.user = this.lastRole === role ? this.view.user + text : text;
        else this.view.assistant += text;
        this.lastRole = role; this.emit();
      },
      interrupted: () => { this.ignored = false; this.clearPerformance(); },
      complete: () => { this.complete = true; this.pending = []; this.ignored = false; },
      error: error => { this.view.error = error; this.emit(); },
    });
    this.frame = requestAnimationFrame(this.tick);
  }
  attach(port: CharacterPort) { this.pending = []; this.director.attach(port); }
  async start() {
    const operation = ++this.operation;
    this.demoStart = null; this.view.demo = false; this.view.error = ''; this.view.user = ''; this.view.assistant = ''; this.lastRole = '';
    try {
      // Unlock audio inside the user's click before network work.
      await this.playback.unlock(); if (operation !== this.operation) return;
      await this.live.connect(); if (operation !== this.operation) return;
      await this.microphone.start(data => this.live.audio(data));
      if (operation !== this.operation) await this.microphone.stop();
    } catch (error) {
      if (operation !== this.operation) return;
      this.view.error = error instanceof Error ? error.message : 'تعذّر تشغيل الميكروفون.';
      await this.stop(); this.emit();
    }
  }
  async stop() {
    ++this.operation; this.demoStart = null; this.view.demo = false; this.ignored = false;
    this.live.close(); this.clearPerformance(); this.director.mode('idle'); this.emit(); await this.microphone.stop();
  }
  private clearPerformance() { this.pending = []; this.complete = true; this.playback.interrupt(); this.director.interrupt(); }
  interrupt() {
    if (this.demoStart !== null) { this.demoStart = null; this.view.demo = false; }
    this.clearPerformance(); this.ignored = this.view.connection === 'connected';
    this.director.mode(this.view.connection === 'connected' ? 'listening' : 'idle'); this.emit();
  }
  send(text: string) { if (this.view.connection !== 'connected' || !text.trim()) return; this.view.user = text.trim(); this.view.assistant = ''; this.lastRole = 'user'; this.live.text(text); this.director.mode('thinking'); this.emit(); }
  manual(expression: Expression, gesture: Gesture = 'none') {
    this.director.enqueue({ id: `manual-${performance.now()}`, expression, intensity: .7, gesture, duration: 3, turn: this.turn, at: this.now });
  }
  async demo() {
    const stopping = this.stop(); const operation = this.operation; await stopping; if(operation !== this.operation) return; this.view.demo = true; this.view.error = ''; this.demoStart = performance.now() / 1000;
    this.turn += 1; this.director.beginTurn(this.turn); const now = this.demoStart;
    const beats: { at: number; expression: Expression; gesture: Gesture }[] = [
      { at: .5, expression: 'happy', gesture: 'wave' }, { at: 3, expression: 'thinking', gesture: 'think' },
      { at: 5.5, expression: 'surprised', gesture: 'explain' }, { at: 8, expression: 'excited', gesture: 'celebrate' },
    ];
    for (const beat of beats) this.director.enqueue({ ...beat, id: `demo-${beat.at}`, intensity: .7, duration: 2.2, turn: this.turn, at: now + beat.at });
    this.emit();
  }
  private get now() { return this.demoStart !== null || this.view.connection === 'offline' ? performance.now() / 1000 : this.playback.now; }
  private tick = (ms: number) => {
    if (this.demoStart !== null) {
      const now = ms / 1000, elapsed = now - this.demoStart;
      const names = ['REST', 'MBP', 'AA', 'EE', 'L', 'OH', 'OO', 'REST'] as const;
      const viseme = names[Math.floor(elapsed * 5) % names.length];
      const mouth: MouthFrame = { viseme, energy: viseme === 'REST' ? 0 : .4, open: viseme === 'MBP' || viseme === 'REST' ? 0 : .25 + Math.max(0, Math.sin(elapsed * 12)) * .4 };
      this.director.tick(now, mouth, elapsed < 10);
      if (elapsed >= 10.5) this.interrupt();
    } else {
      const sample = this.playback.sample(); this.director.tick(this.view.connection === 'offline' ? ms / 1000 : sample.now, sample.mouth, sample.speaking);
      this.view.energy = sample.mouth?.energy ?? 0;
      if (sample.drained && this.complete) this.director.mode(this.view.connection === 'connected' ? 'listening' : this.view.connection === 'connecting' ? 'thinking' : 'idle');
    }
    if (ms - this.lastPublish > 100) { this.lastPublish = ms; this.emit(); }
    this.frame = requestAnimationFrame(this.tick);
  };
  private emit() { this.view.mode = this.director.snapshot().mode; this.publish({ ...this.view }); }
  dispose() { ++this.operation; cancelAnimationFrame(this.frame); this.live.close(); void this.microphone.stop(); void this.playback.close(); this.director.dispose(); }
}
