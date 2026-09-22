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
class FakeContext { currentTime=0;state='running';async resume(){} async close(){} }
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
  assert.equal(view!.toolApplied,2);assert.ok(faces.includes('sad'));
  const received=view!.toolReceived;
  session.storyTest();assert.ok(socket.sent.at(-1).realtimeInput.text.includes('ستة مشاهد'));
  assert.equal(view!.toolReceived,received); // A test request never fabricates model tool calls.
  session.manual('happy');frame(800);assert.equal(view!.toolReceived,received);
  const log=session.exportLog();assert.ok(log.includes('أنت: اعمل وش تفكير'));assert.ok(log.includes('الشخصية: حاضر'));
  assert.equal(log.match(/perform \[/g)?.length,2);assert.ok(log.includes('→ applied'));
  assert.ok(!log.includes('DO_NOT_EXPORT_TOKEN'));assert.ok(!log.includes('manual-'));assert.ok(!log.includes('audio/pcm'));
 } finally { session.dispose();Microphone.prototype.start=originalStart;Microphone.prototype.stop=originalStop; }
});
