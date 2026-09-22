import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionController, type SessionView } from '../src/engine-app/core/SessionController.ts';
import { Microphone } from '../src/engine-app/audio/Microphone.ts';
class FakeSocket {
 static OPEN=1;static last:FakeSocket;readyState=1;sent:any[]=[];
 onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;
 constructor(){FakeSocket.last=this;queueMicrotask(()=>this.onopen?.());}
 send(value:string){const data=JSON.parse(value);this.sent.push(data);if(data.setup)this.message({setupComplete:{}});}
 message(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
 close(){this.readyState=3;this.onclose?.();}
}
class FakeContext {
 static last:FakeContext;currentTime=0;state='running';destination={};
 constructor(){FakeContext.last=this;} async resume(){} async close(){}
 createBuffer(_channels:number,size:number,rate:number){return {duration:size/rate,getChannelData:()=>new Float32Array(size)};}
 createBufferSource(){return {buffer:null,connect(){},disconnect(){},start(){},stop(){},onended:null};}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
let frame:(ms:number)=>void=()=>{};
Object.assign(globalThis,{window:globalThis,WebSocket:FakeSocket,AudioContext:FakeContext,
 requestAnimationFrame:(callback:(ms:number)=>void)=>{frame=callback;return 1;},cancelAnimationFrame:()=>{},
 fetch:async()=>new Response(JSON.stringify({token:'DO_NOT_EXPORT_TOKEN',model:'gemini-3.8-live'}))});
test('live tool-only requests reach renderer, story test sends a prompt, and copy excludes local demos and secrets',async()=>{
 const originalStart=Microphone.prototype.start,originalStop=Microphone.prototype.stop;
 Microphone.prototype.start=async()=>{};Microphone.prototype.stop=async()=>{};
 let view:SessionView;const faces:string[]=[];const gestures:string[]=[];
 const session=new SessionController(value=>{view=value;});
 try {
  session.attach({expression:value=>faces.push(value),gesture:value=>gestures.push(value),mouth(){},mode(){},cancel(){},destroy(){}},{name:'بندق',species:'bear'});
  await session.start();const socket=FakeSocket.last;
  session.send('اعمل وش تفكير');
  socket.message({toolCall:{functionCalls:[{id:'thinking-now',name:'perform',args:{expression:'thinking',gesture:'think',timing:'immediate'}}]}});await settle();frame(200);
  assert.equal(view!.toolReceived,1);assert.equal(view!.toolApplied,1);assert.ok(faces.includes('thinking'));assert.ok(gestures.includes('think'));
  socket.message({serverContent:{outputTranscription:{text:'حاضر'},turnComplete:true}});await settle();frame(400);
  socket.message({toolCall:{functionCalls:[{id:'late-no-audio',name:'perform',args:{expression:'sad',timing:'next_audio'}}]},serverContent:{turnComplete:true}});await settle();frame(600);
  assert.equal(view!.toolApplied,1);assert.ok(!faces.includes('sad'));assert.equal(view!.toolTrace.at(-1)?.reason,'no_speech_available');
  const received=view!.toolReceived;
  session.storyTest();assert.ok(socket.sent.at(-1).realtimeInput.text.includes('توتة توتة خلصت الحدوتة'));
  assert.equal(view!.toolReceived,received); // A test request never fabricates model tool calls.
  session.manual('happy');frame(800);assert.equal(view!.toolReceived,received);
  const log=session.exportLog();assert.ok(log.includes('أنت: اعمل وش تفكير'));assert.ok(log.includes('الشخصية: حاضر'));
  assert.equal(log.match(/perform \[/g)?.length,2);assert.ok(log.includes('→ applied'));
  assert.ok(!log.includes('DO_NOT_EXPORT_TOKEN'));assert.ok(!log.includes('manual-'));assert.ok(!log.includes('audio/pcm'));
 } finally { session.dispose();Microphone.prototype.start=originalStart;Microphone.prototype.stop=originalStop; }
});
test('a tool received during buffered speech dispatches before turnComplete and without new audio',async()=>{
 const originalStart=Microphone.prototype.start,originalStop=Microphone.prototype.stop;
 Microphone.prototype.start=async()=>{};Microphone.prototype.stop=async()=>{};
 let view:SessionView;const rendered:{face:string;clock:number}[]=[];
 const session=new SessionController(value=>{view=value;});
 try{
  session.attach({expression:face=>rendered.push({face,clock:FakeContext.last?.currentTime??0}),gesture(){},mouth(){},mode(){},cancel(){},destroy(){}});
  await session.start();const socket=FakeSocket.last;
  socket.message({serverContent:{modelTurn:{parts:[{inlineData:{data:btoa('\0'.repeat(24000*12*2)),mimeType:'audio/pcm;rate=24000'}}]}}});await settle();
  FakeContext.last.currentTime=3;frame(3000);
  socket.message({toolCall:{functionCalls:[{id:'during-speech',name:'perform',args:{expression:'thinking',gesture:'think',timing:'with_speech'}}]}});await settle();frame(3150);
  assert.equal(view!.toolApplied,1);assert.ok(rendered.some(r=>r.face==='thinking'&&r.clock===3));
  assert.ok(session.exportLog().includes('audio=playing'));assert.ok(session.exportLog().includes('clock=3.000s'));
  assert.ok(session.exportLog().includes('route=current_audio'));assert.match(session.exportLog(),/remaining=9\.0[78]s/);
  socket.message({serverContent:{turnComplete:true}});await settle();frame(3200);assert.equal(view!.toolApplied,1);
 }finally{session.dispose();Microphone.prototype.start=originalStart;Microphone.prototype.stop=originalStop;}
});
test('a tool received before already queued audio starts uses the queue head, not a later packet',async()=>{
 const originalStart=Microphone.prototype.start,originalStop=Microphone.prototype.stop;
 Microphone.prototype.start=async()=>{};Microphone.prototype.stop=async()=>{};
 let view:SessionView;const session=new SessionController(value=>{view=value;});
 try{
  session.attach({expression(){},gesture(){},mouth(){},mode(){},cancel(){},destroy(){}});await session.start();const socket=FakeSocket.last;
  socket.message({serverContent:{modelTurn:{parts:[{inlineData:{data:btoa('\0'.repeat(24000*2)),mimeType:'audio/pcm;rate=24000'}}]}}});await settle();
  socket.message({toolCall:{functionCalls:[{id:'queued-start',name:'perform',args:{expression:'happy',gesture:'wave',timing:'next_audio'}}]}});await settle();frame(200);
  assert.equal(view!.toolApplied,0);
  FakeContext.last.currentTime=.08;frame(400);assert.equal(view!.toolApplied,1);
  assert.ok(session.exportLog().includes('route=queued_audio_start'));assert.ok(session.exportLog().includes('audio=playing'));
 }finally{session.dispose();Microphone.prototype.start=originalStart;Microphone.prototype.stop=originalStop;}
});
