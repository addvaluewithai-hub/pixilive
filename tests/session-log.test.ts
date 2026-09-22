import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionLog } from '../src/engine-app/core/SessionLog.ts';
const cue={expression:'thinking' as const,gesture:'think' as const,intensity:.8,duration:4,timing:'immediate' as const};
test('copy log merges speech chunks and updates one tool entry with its outcome',()=>{
 const log=new SessionLog();log.reset('إمبر');log.model='gemini-3.8-live';
 log.message('user','اعمل وش ',false);log.message('user','تفكير',true);
 log.beginTurn();log.message('assistant','أنا ',true);
 log.tool('call-1',1,cue,'received','awaiting_audio');log.update('call-1',1,'scheduled','immediate');
 log.message('assistant','بفكر',true);log.update('call-1',1,'applied','renderer_called');
 const output=log.export();
 assert.ok(output.includes('أنت: اعمل وش تفكير'));assert.ok(output.includes('الشخصية: أنا بفكر'));
 assert.equal(output.match(/perform \[/g)?.length,1);assert.ok(output.includes('thinking / think'));
 assert.ok(output.includes('gemini-3.8-live'));assert.ok(output.includes('→ applied'));
 assert.ok(!output.includes('awaiting_audio'));assert.ok(!output.includes('scheduled'));assert.ok(!output.includes('renderer_called'));
});
test('turns stay separate, character switches remain visible and cancellation retains evidence of dispatch',()=>{
 const log=new SessionLog();log.reset('إمبر');log.message('assistant','أول رد',true);log.beginTurn();log.message('assistant','تاني رد',true);
 log.tool('call-1',1,cue,'applied','renderer_called');log.update('call-1',1,'cancelled','character_changed');log.avatar('بندق');
 const output=log.export();assert.equal(output.match(/الشخصية:/g)?.length,2);assert.ok(output.includes('applied → cancelled'));assert.ok(output.includes('بندق'));
 log.reset('لوز');assert.ok(!log.export().includes('أول رد'));assert.ok(!log.export().includes('call-1'));
});
test('bounded logs disclose removed history rather than pretending to export everything',()=>{
 const log=new SessionLog();log.reset('إمبر');for(let i=0;i<510;i++)log.message('user',`message ${i}`,false);
 const output=log.export();assert.ok(output.includes('Earlier entries omitted: 11'));assert.ok(output.includes('message 509'));
});
test('one concise tool row preserves separate arrival, actual execution and playback evidence',()=>{
 const originalNow=Date.now;let now=1000;Date.now=()=>now;
 try{
  const log=new SessionLog();log.reset('إمبر');now=2000;log.tool('timed',1,cue,'received','awaiting_audio');
  log.update('timed',1,'scheduled','current_audio');now=2025;
  log.update('timed',1,'applied','renderer_called',{clock:3,queued:9,speaking:true});
  now=3000;log.update('timed',1,'cancelled','server_interrupted');const output=log.export();
  assert.ok(output.includes('executed=1.025s; wait=25ms'));assert.ok(output.includes('audio=playing; clock=3.000s; remaining=9.00s'));
  assert.ok(output.includes('route=current_audio'));assert.equal(output.match(/perform \[/g)?.length,1);
 }finally{Date.now=originalNow;}
});
