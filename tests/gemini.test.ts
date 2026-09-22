import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiAdapter, type LiveEvents } from '../src/engine-app/live/GeminiAdapter.ts';
class FakeSocket {
 static OPEN=1;static instances:FakeSocket[]=[];readyState=1;sent:any[]=[];
 onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((event:{data:unknown})=>void)|null=null;
 constructor(_url:string){FakeSocket.instances.push(this);queueMicrotask(()=>this.onopen?.());}
 send(value:string){this.sent.push(JSON.parse(value));if(this.sent.at(-1).setup)this.message({setupComplete:{}});}
 message(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
 close(){this.readyState=3;this.onclose?.();}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
Object.assign(globalThis,{window:globalThis,WebSocket:FakeSocket,fetch:async()=>new Response(JSON.stringify({token:'test-ephemeral',model:'gemini-3.8-live'}))});
function fixture(){const calls:{name:string;value?:unknown}[]=[];const events:LiveEvents={status:v=>calls.push({name:'status',value:v}),turn:v=>calls.push({name:'turn',value:v}),audio:(v,rate)=>calls.push({name:'audio',value:[v,rate]}),cue:(id,cue)=>calls.push({name:'cue',value:[id,cue]}),cancel:ids=>calls.push({name:'cancel',value:ids}),transcript:(role,text)=>calls.push({name:role,value:text}),interrupted:()=>calls.push({name:'interrupted'}),complete:()=>calls.push({name:'complete'}),error:v=>calls.push({name:'error',value:v})};return {client:new GeminiAdapter(events),calls};}
test('Gemini setup, cues, multiple audio parts and completion use one turn',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 assert.equal(socket.sent[0].setup.tools[0].functionDeclarations[0].behavior,'NON_BLOCKING');
 socket.message({toolCall:{functionCalls:[{id:'a',name:'perform',args:{expression:'happy',gesture:'wave'}}]},serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAA',mimeType:'audio/pcm;rate=24000'}},{inlineData:{data:'BBBB',mimeType:'audio/pcm;rate=24000'}}]},turnComplete:true}});await settle();
 assert.equal(f.calls.filter(c=>c.name==='turn').length,1);assert.equal(f.calls.filter(c=>c.name==='audio').length,2);assert.equal(socket.sent[1].toolResponse.functionResponses[0].scheduling,'SILENT');assert.ok(f.calls.some(c=>c.name==='complete'));f.client.close();
});
test('cancellation and barge-in discard audio included with interruption',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 socket.message({toolCallCancellation:{ids:['cancelled']},serverContent:{interrupted:true,modelTurn:{parts:[{inlineData:{data:'AAAA',mimeType:'audio/pcm;rate=24000'}}]}}});await settle();
 assert.ok(f.calls.some(c=>c.name==='interrupted'));assert.deepEqual(f.calls.find(c=>c.name==='cancel')?.value,['cancelled']);assert.equal(f.calls.some(c=>c.name==='audio'),false);f.client.close();
});
test('a late Blob decode from a closed connection cannot animate a new session',async()=>{
 const f=fixture();await f.client.connect();const old=FakeSocket.instances.at(-1)!;
 let release:(value:string)=>void=()=>{};const delayed=new Blob();delayed.text=()=>new Promise(resolve=>{release=resolve;});old.onmessage?.({data:delayed});await settle();
 f.client.close();await f.client.connect();release(JSON.stringify({toolCall:{functionCalls:[{id:'old',name:'perform',args:{expression:'angry'}}]}}));await settle();assert.equal(f.calls.some(c=>c.name==='cue'),false);f.client.close();
});
test('explicit close clears the resumption handle for the next conversation',async()=>{
 const f=fixture();await f.client.connect();FakeSocket.instances.at(-1)!.message({sessionResumptionUpdate:{resumable:true,newHandle:'old-session'}});await settle();f.client.close();await f.client.connect();assert.deepEqual(FakeSocket.instances.at(-1)!.sent[0].setup.sessionResumption,{});f.client.close();
});
test('selected avatar, real model and explicit performance instructions reach setup',async()=>{
 const f=fixture();f.client.setAvatar({name:'بندق',species:'bear'});await f.client.connect();
 const setup=FakeSocket.instances.at(-1)!.sent[0].setup;
 assert.equal(setup.model,'models/gemini-3.8-live');
 const prompt=setup.systemInstruction.parts[0].text;
 assert.ok(prompt.includes('بندق (bear)'));assert.ok(prompt.includes('MUST call perform'));
 assert.ok(prompt.includes('complete story'));assert.ok(prompt.includes('never send all scene cues at the start'));
 assert.deepEqual(setup.tools[0].functionDeclarations[0].parameters.properties.timing.enum,['immediate','with_speech']);
 f.client.close();
});
test('direct tool-only turn preserves immediate cue before turn completion',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 socket.message({toolCall:{functionCalls:[{id:'think',name:'perform',args:{expression:'thinking',gesture:'think',timing:'immediate'}}]},serverContent:{turnComplete:true}});await settle();
 const received=f.calls.find(c=>c.name==='cue')?.value as [string,{timing:string}];
 assert.equal(received[0],'think');assert.equal(received[1].timing,'immediate');
 assert.ok(f.calls.findIndex(c=>c.name==='cue')<f.calls.findIndex(c=>c.name==='complete'));
 f.client.close();
});
test('silent acknowledgements use the protocol envelope and batch every result once',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 const calls=[{id:'1',name:'perform',args:{expression:'thinking'}},{id:'2',name:'perform',args:{expression:'excited'}}];
 socket.message({toolCall:{functionCalls:calls}});await settle();
 const responses=socket.sent.filter(m=>m.toolResponse);assert.equal(responses.length,1);
 assert.deepEqual(responses[0].toolResponse.functionResponses,[
  {id:'1',name:'perform',scheduling:'SILENT',response:{result:'accepted'}},
  {id:'2',name:'perform',scheduling:'SILENT',response:{result:'accepted'}}]);
 // Documented default is WHEN_IDLE when the envelope has no scheduling field.
 // A nested response.scheduling would fail this check and can trigger extra speech.
 for(const response of responses[0].toolResponse.functionResponses){assert.equal(response.scheduling??'WHEN_IDLE','SILENT');assert.equal('scheduling' in response.response,false);}
 socket.message({toolCall:{functionCalls:calls}});await settle();
 assert.equal(socket.sent.filter(m=>m.toolResponse).length,1);assert.equal(f.calls.filter(c=>c.name==='cue').length,2);f.client.close();
});
test('interrupted packets cannot restart stale speech or gestures',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 socket.message({serverContent:{interrupted:true,outputTranscription:{text:'stale text'},turnComplete:true},toolCall:{functionCalls:[{id:'old',name:'perform',args:{expression:'happy'}}]}});await settle();
 assert.equal(f.calls.some(c=>['turn','cue','assistant','audio'].includes(c.name)),false);
 assert.deepEqual(socket.sent.at(-1).toolResponse.functionResponses[0],{id:'old',name:'perform',scheduling:'SILENT',response:{result:'cancelled'}});f.client.close();
});
test('speech recognition receives language hints and invalid cues are acknowledged silently',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 assert.deepEqual(socket.sent[0].setup.inputAudioTranscription.languageCodes,['ar-EG','en-US']);
 socket.message({toolCall:{functionCalls:[{id:'bad',name:'perform',args:{expression:'not-real'}}]}});await settle();
 assert.equal(f.calls.some(c=>c.name==='cue'),false);assert.equal(socket.sent.at(-1).toolResponse.functionResponses[0].scheduling,'SILENT');f.client.close();
});
test('switching to a flyer updates model context through the next silent result without triggering a new utterance',async()=>{
 const f=fixture();await f.client.connect();const socket=FakeSocket.instances.at(-1)!;
 const before=socket.sent.length;f.client.setAvatar({name:'لومي',species:'sprite',canFly:true});assert.equal(socket.sent.length,before);
 socket.message({toolCall:{functionCalls:[{id:'post-switch',name:'perform',args:{expression:'happy'}}]}});await settle();
 const response=socket.sent.at(-1).toolResponse.functionResponses[0];assert.equal(response.scheduling,'SILENT');assert.deepEqual(response.response.avatar,{name:'لومي',species:'sprite',canFly:true});
 socket.message({toolCall:{functionCalls:[{id:'same-avatar',name:'perform',args:{expression:'thinking'}}]}});await settle();assert.equal(socket.sent.at(-1).toolResponse.functionResponses[0].response.avatar,undefined);f.client.close();
});
