import { restMouth } from './types.ts';
import type { CharacterPort, Mode, MouthFrame, TimedCue } from './types.ts';

export interface PerformanceEvent { id: string; turn: number; status: 'applied' | 'cancelled' | 'skipped'; reason: string }

/** All times are seconds from the playback clock, never socket arrival time. */
export class PerformanceDirector {
  private report: (event: PerformanceEvent) => void;
  constructor(report: (event: PerformanceEvent) => void = () => {}) { this.report = report; }
  private clear(reason: string) {
    for (const cue of this.queue) this.report({id:cue.id,turn:cue.turn,status:'cancelled',reason});
    if(this.active)this.report({id:this.active.id,turn:this.active.turn,status:'cancelled',reason});
    this.queue=[];this.active=null;
  }
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
    this.clear('character_changed');
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
    if (this.queue.length > 32) for(const c of this.queue.splice(0,this.queue.length-32))this.report({id:c.id,turn:c.turn,status:'skipped',reason:'queue_limit'});
  }
  cancelCalls(ids: string[]) {
    for(const c of this.queue)if(ids.includes(c.id))this.report({id:c.id,turn:c.turn,status:'cancelled',reason:'tool_cancelled'});
    this.queue = this.queue.filter(c => !ids.includes(c.id));
    if (this.active && ids.includes(this.active.id)) { this.report({id:this.active.id,turn:this.active.turn,status:'cancelled',reason:'tool_cancelled'}); this.active = null; this.port?.cancel(); this.port?.expression('neutral', 0); }
  }
  tick(now: number, mouth: MouthFrame | null, speaking: boolean) {
    let latest: TimedCue | undefined;
    while (this.queue.length && this.queue[0].at <= now) {
      if(latest)this.report({id:latest.id,turn:latest.turn,status:'skipped',reason:'superseded_same_frame'});
      latest = this.queue.shift();
    }
    if(latest && now>=latest.at+latest.duration)this.report({id:latest.id,turn:latest.turn,status:'skipped',reason:'expired'});
    if (latest && now < latest.at + latest.duration) {
      this.active = latest;
      this.port?.expression(latest.expression, latest.intensity);
      const gestureAllowed=latest.gesture !== 'none' && now-this.lastGesture>=1.1;
      if (gestureAllowed) {
        this.port?.gesture(latest.gesture);
        this.lastGesture = now;
      }
      this.report({id:latest.id,turn:latest.turn,status:this.port?'applied':'skipped',reason:!this.port?'no_renderer':latest.gesture!=='none'&&!gestureAllowed?'expression_only_gesture_cooldown':'renderer_called'});
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
    this.clear('interrupted_or_new_turn'); this.seen.clear(); this.lastGesture = -Infinity;
    this.port?.cancel(); this.port?.mouth(restMouth); this.port?.expression('neutral', 0);
    this.mode('listening');
  }
  dispose() { this.interrupt(); this.port?.destroy(); this.port = null; }
  snapshot() { return { mode: this.currentMode, turn: this.turn, queued: this.queue.length, active: this.active?.id ?? null }; }
}
