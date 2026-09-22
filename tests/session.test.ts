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
test('flight calls run during audio independently of gestures, log one outcome, and cancel on interruption/switch',async()=>{
 const originalStart=Microphone.prototype.start,originalStop=Microphone.prototype.stop;
 Microphone.prototype.start=async()=>{};Microphone.prototype.stop=async()=>{};
 let view:SessionView;let flights=0,stops=0,moving=false,destroyed=0;
 const session=new SessionController(value=>{view=value;});
 const port={expression(){},gesture(){},mouth(){},mode(){},cancel(){},destroy(){destroyed++;},fly(){flights++;moving=true;return true;},stopFlight(){stops++;moving=false;},flightState(){return {x:.5,y:.5,vx:0,vy:0,bank:0,lift:1,moving,landed:false};}};
 try{
  session.attach(port,{name:'لومي',species:'sprite',canFly:true});await session.start();const socket=FakeSocket.last;
  const setup=socket.sent[0].setup;assert.equal(setup.tools[0].functionDeclarations[1].name,'fly');assert.equal(setup.tools[0].functionDeclarations[1].behavior,'NON_BLOCKING');assert.ok(setup.systemInstruction.parts[0].text.includes('initial avatar CAN fly'));
  socket.message({serverContent:{modelTurn:{parts:[{inlineData:{data:btoa('\0'.repeat(24000*8*2)),mimeType:'audio/pcm;rate=24000'}}]}}});await settle();FakeContext.last.currentTime=1;frame(1000);
  const fly={id:'flight-1',name:'fly',args:{action:'move',x:.8,y:.1,speed:.6,path:'arc'}};
  socket.message({toolCall:{functionCalls:[fly,{id:'pose',name:'perform',args:{expression:'happy',gesture:'wave',timing:'with_speech'}}]}});await settle();frame(1200);
  assert.equal(flights,1);assert.equal(moving,true);assert.equal(view!.toolApplied,2);assert.ok(session.exportLog().includes('audio=playing'));
  socket.message({toolCall:{functionCalls:[fly]}});await settle();assert.equal(flights,1);
  const reply=socket.sent.find(m=>m.toolResponse).toolResponse.functionResponses[0];assert.equal(reply.scheduling,'SILENT');assert.equal(reply.response.result,'accepted');
  socket.message({serverContent:{turnComplete:true}});await settle();frame(1500);assert.equal(moving,true);
  moving=false;frame(1700);assert.equal(view!.toolTrace.find(t=>t.id==='flight-1')?.status,'completed');assert.equal(view!.toolApplied,2);
  session.flightTest();assert.ok(socket.sent.at(-1).realtimeInput.text.includes('fly'));assert.equal(view!.toolReceived,2);
  session.manualFlight({action:'hover',x:.5,y:.5,speed:.5,path:'direct'});assert.equal(view!.toolReceived,2);
  socket.message({toolCall:{functionCalls:[{...fly,id:'flight-2'}]}});await settle();const stopBefore=stops;
  socket.message({serverContent:{interrupted:true}});await settle();assert.ok(stops>stopBefore);assert.equal(moving,false);assert.ok(session.exportLog().includes('applied → cancelled (server_interrupted)'));
  socket.message({toolCall:{functionCalls:[{...fly,id:'flight-3'}]}});await settle();
  session.attach({expression(){},gesture(){},mouth(){},mode(){},cancel(){},destroy(){}},{name:'بندق',species:'bear'});assert.equal(destroyed,1);assert.equal(moving,false);
  socket.message({toolCall:{functionCalls:[{...fly,id:'ground'},{id:'invalid-flight',name:'fly',args:{action:'move',x:999,y:0}}]}});await settle();
  assert.equal(view!.toolTrace.find(t=>t.id==='ground')?.status,'rejected');assert.ok(socket.sent.at(-1).toolResponse.functionResponses[0].response.result.startsWith('not applied'));
  const log=session.exportLog();assert.equal(log.match(/fly \[/g)?.length,5);assert.ok(!log.includes('audio/pcm'));assert.ok(!log.includes('DO_NOT_EXPORT_TOKEN'));assert.ok(log.includes('character_changed'));
 }finally{session.dispose();Microphone.prototype.start=originalStart;Microphone.prototype.stop=originalStop;}
});
