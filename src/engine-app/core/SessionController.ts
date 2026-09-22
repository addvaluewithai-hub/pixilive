import { SessionLog } from './SessionLog.ts';
import { CueScheduler } from './CueScheduler.ts';
import { storyTestPrompt } from '../live/performancePrompt.ts';
import type { AvatarContext } from '../live/performancePrompt.ts';
import { PlaybackClock } from '../audio/PlaybackClock.ts';
import { Microphone } from '../audio/Microphone.ts';
import { GeminiAdapter } from '../live/GeminiAdapter.ts';
import { PerformanceDirector } from './PerformanceDirector.ts';
import type { CharacterPort, Expression, Gesture, Mode, MouthFrame } from './types.ts';
export interface ToolTrace { id:string; turn:number; expression:string; gesture:string; status:'received'|'scheduled'|'applied'|'cancelled'|'skipped'|'rejected'; reason:string }
export interface SessionView { model:string; toolReceived:number; toolApplied:number; toolTrace:ToolTrace[]; connection: 'offline' | 'connecting' | 'connected'; mode: Mode; error: string; user: string; assistant: string; demo: boolean; energy: number }
export const initialSessionView: SessionView = { model:'',toolReceived:0,toolApplied:0,toolTrace:[], connection: 'offline', mode: 'idle', error: '', user: '', assistant: '', demo: false, energy: 0 };
export class SessionController {
  readonly director = new PerformanceDirector(event => this.traceUpdate(event.id,event.status,event.reason,event.turn));
  private log = new SessionLog();
  private avatarName = 'إمبر';
  exportLog() { return this.log.export(); }
  private playback = new PlaybackClock();
  private microphone = new Microphone();
  private live: GeminiAdapter;
  private view: SessionView = { ...initialSessionView,toolTrace:[] };
  private publish: (view: SessionView) => void;
  private turn = 0;
  private cues = new CueScheduler((id,turn) => this.traceUpdate(id,'skipped','queue_limit',turn));
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
      model: model => { this.log.model=model; this.view.model=model; this.emit(); },
      rejectedCue: id => { this.log.tool(id,this.turn,null,'rejected','invalid_arguments'); this.view.toolReceived++; this.view.toolTrace=[...this.view.toolTrace.slice(-39),{id,turn:this.turn,expression:'invalid',gesture:'unknown',status:'rejected',reason:'invalid_arguments'}]; this.emit(); },
      status: connection => {
        this.view.connection = connection;
        if (connection === 'connected') this.director.mode('listening');
        if (connection === 'offline' && !this.view.demo) { void this.microphone.stop(); this.playback.interrupt(); this.director.interrupt('connection_closed'); this.director.mode('idle'); }
        this.emit();
      },
      turn: id => { this.clearPending('new_turn'); this.turn = id; this.cues.begin(id); this.log.beginTurn(); this.complete = false; this.view.assistant = ''; if (!this.ignored) this.director.beginTurn(id, true); },
      audio: (data, rate) => {
        if (this.ignored) return;
        this.playback.enqueue(data, rate);
        this.scheduleAudible();
      },
      cue: (id, cue) => {
        if(this.view.toolTrace.some(t=>t.id===id&&t.turn===this.turn))return;
        this.log.tool(id,this.turn,cue,this.ignored?'cancelled':'received',this.ignored?'interrupted':'awaiting_audio');
        this.view.toolReceived++;
        this.view.toolTrace=[...this.view.toolTrace.slice(-39),{id,turn:this.turn,expression:cue.expression,gesture:cue.gesture,status:this.ignored?'cancelled':'received',reason:this.ignored?'interrupted':'awaiting_audio'}];
        if(!this.ignored){
          const at=this.playback.performanceAt;
          this.schedule(this.cues.receive(id,cue,this.playback.now,at),cue.timing==='immediate'?'immediate':at!==null&&at<=this.playback.now?'current_audio':'queued_audio_start');
        }
        this.emit();
      },
      cancel: ids => { this.cues.cancel(ids); for(const id of ids)this.traceUpdate(id,'cancelled','tool_cancelled'); this.director.cancelCalls(ids); },
      transcript: (role, text) => {
        if (role === 'assistant' && this.ignored) return;
        this.log.message(role,text,role==='assistant'||this.lastRole===role);
        if (role === 'user') this.view.user = this.lastRole === role ? this.view.user + text : text;
        else this.view.assistant += text;
        this.lastRole = role; this.emit();
      },
      interrupted: () => { this.ignored = false; this.clearPerformance('server_interrupted'); },
      complete: () => {
        this.complete = true;
        if(!this.ignored){
          this.scheduleAudible();
          for(const id of this.cues.clear())this.traceUpdate(id,'skipped','no_speech_available');
        }else this.clearPending('interrupted');
        this.ignored = false;
      },
      error: error => { this.view.error = error; this.emit(); },
    });
    this.frame = requestAnimationFrame(this.tick);
  }
  private traceUpdate(id:string,status:ToolTrace['status'],reason:string,turn=this.turn) {
    const audio=status==='applied'?{clock:this.playback.now,queued:this.playback.queuedSeconds,speaking:this.playback.sample().speaking}:undefined;
    this.log.update(id,turn,status,reason,audio);
    const row=this.view.toolTrace.find(t=>t.id===id&&t.turn===turn);
    if(!row)return;
    if(status==='applied'&&row.status!=='applied')this.view.toolApplied++;
    this.view.toolTrace=this.view.toolTrace.map(t=>t===row?{...t,status,reason}:t);
  }
  private scheduleAudible(){
    const at=this.playback.performanceAt;
    if(at!==null)this.schedule(this.cues.flush(at),at<=this.playback.now?'current_audio':'queued_audio_start');
  }
  private clearPending(reason:string){for(const id of this.cues.clear())this.traceUpdate(id,'cancelled',reason);}
  private schedule(cues:ReturnType<CueScheduler['flush']>,reason:string){for(const cue of cues){this.traceUpdate(cue.id,'scheduled',reason);this.director.enqueue(cue);}}
  attach(port: CharacterPort,avatar?:AvatarContext) { this.clearPending('character_changed'); this.director.attach(port); if(avatar){this.live.setAvatar(avatar);if(this.avatarName!==avatar.name){this.avatarName=avatar.name;this.log.avatar(avatar.name);}} }
  storyTest(){this.send(storyTestPrompt,'[قراءة قصة مكتوبة كاملة] نادر ونونو وفانوس الغابة؛ 30 جملة، وحركة في كل جملتين، باستخدام جميع الحركات الست، بدون انتظار كمل.');}

  async start() {
    const operation = ++this.operation;
    this.log.reset(this.avatarName);
    this.view.toolTrace=[];this.view.toolReceived=0;this.view.toolApplied=0;this.view.model='';
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
  private clearPerformance(reason = 'session_stopped') { this.clearPending(reason); this.complete = true; this.playback.interrupt(); this.director.interrupt(reason); }
  interrupt() {
    if (this.demoStart !== null) { this.demoStart = null; this.view.demo = false; }
    this.clearPerformance('user_interrupt'); this.ignored = this.view.connection === 'connected';
    this.director.mode(this.view.connection === 'connected' ? 'listening' : 'idle'); this.emit();
  }
  send(text: string, logText=text) { if (this.view.connection !== 'connected' || !text.trim()) return; this.log.message('user',logText.trim(),false); this.view.user = logText.trim(); this.view.assistant = ''; this.lastRole = 'user'; this.live.text(text); this.director.mode('thinking'); this.emit(); }
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
