import test from 'node:test';
import assert from 'node:assert/strict';
import { CueScheduler } from '../src/engine-app/core/CueScheduler.ts';
import { PerformanceDirector, type PerformanceEvent } from '../src/engine-app/core/PerformanceDirector.ts';
import { parseCue } from '../src/engine-app/core/types.ts';
const cue = {expression:'thinking' as const,gesture:'think' as const,intensity:.8,duration:4};
test('explicit face requests dispatch without waiting for audio',()=>{
 const scheduler=new CueScheduler();scheduler.begin(7);
 assert.deepEqual(scheduler.receive('direct',{...cue,timing:'immediate'},12),[{...cue,timing:'immediate',id:'direct',turn:7,at:12}]);
 assert.deepEqual(scheduler.flush(20),[]);
 assert.deepEqual(scheduler.receive('direct',{...cue,timing:'immediate'},13),[]);
});
test('narrative cues run on current speech without another incoming audio packet',()=>{
 const scheduler=new CueScheduler();scheduler.begin(1);
 for(const timing of ['with_speech','next_audio'] as const){
  const result=scheduler.receive(timing,{...cue,timing},3,3);
  assert.equal(result[0].at,3);assert.deepEqual(scheduler.flush(12),[]);
 }
});
test('queued speech uses its first audible start, while absent speech waits and can be discarded',()=>{
 const scheduler=new CueScheduler();scheduler.begin(1);
 assert.equal(scheduler.receive('queued',cue,0,.075)[0].at,.075);
 assert.deepEqual(scheduler.receive('waiting',cue,1,null),[]);
 assert.equal(scheduler.flush(1.2)[0].at,1.2);
 scheduler.receive('no-speech',cue,6,null);assert.deepEqual(scheduler.clear(),['no-speech']);
 assert.deepEqual(scheduler.flush(8),[]);
});
test('cancellation, character switch, new turn and overflow do not leave stale cues',()=>{
 const dropped:string[]=[];const scheduler=new CueScheduler(id=>dropped.push(id));scheduler.begin(1);
 scheduler.receive('cancel',cue,0);scheduler.cancel(['cancel']);assert.deepEqual(scheduler.flush(1),[]);
 scheduler.receive('switch',cue,0);assert.deepEqual(scheduler.clear(),['switch']);assert.deepEqual(scheduler.flush(1),[]);
 scheduler.receive('old',cue,0);scheduler.begin(2);assert.deepEqual(scheduler.flush(1),[]);
 for(let i=0;i<40;i++)scheduler.receive(`cue-${i}`,cue,0);
 assert.equal(dropped.length,8);assert.equal(scheduler.flush(1).length,32);
});
test('diagnostics distinguish same-frame supersession, renderer dispatch and gesture cooldown',()=>{
 const events:PerformanceEvent[]=[];const gestures:string[]=[];
 const director=new PerformanceDirector(e=>events.push(e));
 director.attach({expression(){},gesture:g=>gestures.push(g),mouth(){},mode(){},cancel(){},destroy(){}});
 director.beginTurn(1);
 director.enqueue({...cue,id:'first',turn:1,at:1});director.enqueue({...cue,id:'second',turn:1,at:1});director.tick(1,null,false);
 assert.ok(events.some(e=>e.id==='first'&&e.status==='skipped'&&e.reason==='superseded_same_frame'));
 assert.ok(events.some(e=>e.id==='second'&&e.status==='applied'));
 director.enqueue({...cue,id:'third',turn:1,at:1.2});director.tick(1.2,null,false);
 assert.equal(events.at(-1)?.reason,'expression_only_gesture_cooldown');assert.equal(gestures.length,1);
 director.beginTurn(2);assert.equal(events.at(-1)?.turn,1);assert.equal(events.at(-1)?.status,'cancelled');
});
test('unsupported timing is rejected before scheduling',()=>{
 assert.equal(parseCue({...cue,timing:'pretend'}),null);
 assert.equal(parseCue({...cue,timing:'immediate'})?.timing,'immediate');
});
