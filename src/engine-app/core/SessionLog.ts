import type { Cue } from './types.ts';
type Role = 'user' | 'assistant';
interface MessageEntry { kind: 'message'; at: number; role: Role; text: string }
interface PlaybackDiagnostic { clock: number; queued: number; speaking: boolean }
interface ToolEntry { kind: 'tool'; at: number; id: string; turn: number; cue: Cue | null; status: string; reason: string; route?: string; appliedAt?: number; audio?: PlaybackDiagnostic }
interface AvatarEntry { kind: 'avatar'; at: number; name: string }
type Entry = MessageEntry | ToolEntry | AvatarEntry;
/** Human-readable diagnostics only: no audio, transport payloads, tokens or per-frame events. */
export class SessionLog {
  private entries: Entry[] = [];
  private active: Partial<Record<Role, MessageEntry>> = {};
  private started = Date.now();
  private omitted = 0;
  model = '';
  reset(avatar: string) {
    this.entries = []; this.active = {}; this.started = Date.now(); this.omitted = 0; this.model = '';
    this.avatar(avatar);
  }
  private add(entry: Entry) {
    this.entries.push(entry);
    if (this.entries.length > 500) { this.entries.shift(); this.omitted++; }
  }
  avatar(name: string) { this.add({kind:'avatar', at:Date.now(), name}); }
  beginTurn() { this.active = {}; }
  message(role: Role, text: string, append: boolean) {
    const previous = this.active[role];
    if (append && previous && this.entries.includes(previous)) previous.text += text;
    else { const entry: MessageEntry = {kind:'message', at:Date.now(), role, text}; this.active[role] = entry; this.add(entry); }
  }
  tool(id: string, turn: number, cue: Cue | null, status: string, reason: string) {
    this.add({kind:'tool', at:Date.now(), id, turn, cue, status, reason});
  }
  update(id: string, turn: number, status: string, reason: string, audio?: PlaybackDiagnostic) {
    const entry = this.entries.find(e => e.kind === 'tool' && e.id === id && e.turn === turn) as ToolEntry | undefined;
    if (!entry) return;
    if(status==='scheduled')entry.route=reason;
    if(status==='applied'&&entry.appliedAt===undefined){entry.appliedAt=Date.now();entry.audio=audio;}
    // Preserve evidence of earlier dispatch even if a later interruption cancels its remaining hold.
    entry.status = entry.status.startsWith('applied') && status === 'cancelled' ? 'applied → cancelled' : status;
    entry.reason = reason;
  }
  export() {
    const lines = ['PixiLive — conversation + tool calls', `Model: ${this.model || 'not connected'}`, `Started: ${new Date(this.started).toISOString()}`, 'Performance: speech-sync-v3; tool acknowledgements=SILENT; speech accents=local audio-driven'];
    if(this.omitted)lines.push(`Earlier entries omitted: ${this.omitted} (latest 500 retained)`);
    for (const entry of this.entries) {
      const seconds = Math.max(0,Math.floor((entry.at-this.started)/1000));
      const stamp = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
      if (entry.kind === 'message') lines.push(`[${stamp}] ${entry.role === 'user' ? 'أنت' : 'الشخصية'}: ${entry.text.trim()}`);
      else if (entry.kind === 'avatar') lines.push(`[${stamp}] الشخصية المعروضة: ${entry.name}`);
      else {
        const c=entry.cue;
        const args=c ? `${c.expression} / ${c.gesture}; intensity=${c.intensity}; duration=${c.duration}s; timing=${c.timing ?? 'with_speech'}` : 'invalid arguments';
        const reason=['renderer_called','awaiting_audio'].includes(entry.reason) ? '' : ` (${entry.reason})`;
        const applied=entry.appliedAt===undefined?'':` | executed=${((entry.appliedAt-this.started)/1000).toFixed(3)}s; wait=${entry.appliedAt-entry.at}ms`;
        const playback=entry.audio?`; audio=${entry.audio.speaking?'playing':'silent'}; clock=${entry.audio.clock.toFixed(3)}s; remaining=${entry.audio.queued.toFixed(2)}s`:'';
        const route=entry.route?`; route=${entry.route}`:'';
        lines.push(`[${stamp}] perform [turn ${entry.turn}, ${entry.id}]: ${args} → ${entry.status}${reason}${applied}${playback}${route}`);
      }
    }
    return lines.join('\n\n');
  }
}
