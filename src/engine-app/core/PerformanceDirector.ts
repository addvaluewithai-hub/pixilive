import { restMouth } from './types.ts';
import type { CharacterPort, Mode, MouthFrame, TimedCue } from './types.ts';

/** All times are seconds from the playback clock, never socket arrival time. */
export class PerformanceDirector {
  private port: CharacterPort | null = null;
  private queue: TimedCue[] = [];
  private active: TimedCue | null = null;
  private lastGesture = -Infinity;
  private currentMode: Mode = 'idle';
  private turn = 0;
  private seen = new Set<string>();

  attach(port: CharacterPort) {
    this.port?.cancel();
    this.port?.destroy();
    this.port = port;
    // A skin switch keeps conversation/audio, but not old poses or queued gestures.
    this.queue = [];
    this.active = null;
    this.lastGesture = -Infinity;
    port.cancel();
    port.expression('neutral', 0);
    port.mode(this.currentMode);
  }
  beginTurn(turn: number) { this.interrupt(); this.turn = turn; this.mode('thinking'); }
  enqueue(cue: TimedCue) {
    if (cue.turn !== this.turn || this.seen.has(cue.id) || !Number.isFinite(cue.at)) return;
    this.seen.add(cue.id);
    this.queue.push(cue);
    this.queue.sort((a, b) => a.at - b.at);
    // Bound input from a model producing excessive stage directions.
    if (this.queue.length > 32) this.queue.splice(0, this.queue.length - 32);
  }
  cancelCalls(ids: string[]) {
    this.queue = this.queue.filter(c => !ids.includes(c.id));
    if (this.active && ids.includes(this.active.id)) { this.active = null; this.port?.cancel(); this.port?.expression('neutral', 0); }
  }
  tick(now: number, mouth: MouthFrame | null, speaking: boolean) {
    let latest: TimedCue | undefined;
    while (this.queue.length && this.queue[0].at <= now) latest = this.queue.shift();
    if (latest && now < latest.at + latest.duration) {
      this.active = latest;
      this.port?.expression(latest.expression, latest.intensity);
      if (latest.gesture !== 'none' && now - this.lastGesture >= 1.1) {
        this.port?.gesture(latest.gesture);
        this.lastGesture = now;
      }
    }
    if (this.active && now >= this.active.at + this.active.duration) {
      this.active = null;
      this.port?.cancel();
      this.port?.expression('neutral', 0);
    }
    if (speaking) this.mode('speaking');
    else if (this.currentMode === 'speaking') this.mode('thinking');
    this.port?.mouth(mouth ?? restMouth);
  }
  mode(mode: Mode) { if (mode !== this.currentMode) { this.currentMode = mode; this.port?.mode(mode); } }
  interrupt() {
    this.queue = []; this.active = null; this.seen.clear(); this.lastGesture = -Infinity;
    this.port?.cancel(); this.port?.mouth(restMouth); this.port?.expression('neutral', 0);
    this.mode('listening');
  }
  dispose() { this.interrupt(); this.port?.destroy(); this.port = null; }
  snapshot() { return { mode: this.currentMode, turn: this.turn, queued: this.queue.length, active: this.active?.id ?? null }; }
}
