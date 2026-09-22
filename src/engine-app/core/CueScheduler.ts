import type { Cue, TimedCue } from './types.ts';
/** Prefer audible/currently queued speech. Wait only when no audio is available. */
export class CueScheduler {
  private overflow: (id:string,turn:number)=>void;
  constructor(overflow: (id:string,turn:number)=>void = () => {}) { this.overflow=overflow; }
  private pending: {id:string;cue:Cue}[] = [];
  private turn = 0;
  private seen = new Set<string>();
  begin(turn:number) { this.clear(); this.seen.clear(); this.turn=turn; }
  receive(id:string,cue:Cue,now:number,audibleAt:number|null=null):TimedCue[] {
    if(this.seen.has(id))return [];
    this.seen.add(id);
    if(cue.timing==='immediate')return [{...cue,id,turn:this.turn,at:now}];
    if(audibleAt!==null)return [{...cue,id,turn:this.turn,at:Math.max(now,audibleAt)}];
    this.pending.push({id,cue});
    if(this.pending.length>32){const dropped=this.pending.shift()!;this.overflow(dropped.id,this.turn);}
    return [];
  }
  flush(at:number):TimedCue[] { const result=this.pending.map(({id,cue})=>({...cue,id,turn:this.turn,at}));this.pending=[];return result; }
  cancel(ids:string[]){this.pending=this.pending.filter(c=>!ids.includes(c.id));}
  clear(){const ids=this.pending.map(c=>c.id);this.pending=[];return ids;}
}
