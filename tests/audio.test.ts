import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock } from '../src/engine-app/audio/PlaybackClock.ts';
import { PcmResampler } from '../src/engine-app/audio/Microphone.ts';
class FakeSource { buffer: unknown; onended: null | (()=>void)=null; startAt=0; stopped=false; connect(){} disconnect(){} start(at:number){this.startAt=at;} stop(){this.stopped=true;} }
class FakeContext {
  static last: FakeContext; currentTime=0; state='running'; destination={}; sources:FakeSource[]=[];
  constructor(){FakeContext.last=this;} async resume(){this.state='running';} async close(){this.state='closed';}
  createBuffer(_n:number,size:number,rate:number){return { duration:size/rate,getChannelData:()=>new Float32Array(size) };}
  createBufferSource(){const source=new FakeSource();this.sources.push(source);return source;}
}
Object.assign(globalThis,{AudioContext:FakeContext});
const pcm=(n:number)=>btoa('\0'.repeat(n*2));
test('audio queues contiguously and visuals wait for playback',async()=>{
 const clock=new PlaybackClock();await clock.unlock();const a=clock.enqueue(pcm(2400)),b=clock.enqueue(pcm(2400));assert.equal(a,.075);assert.ok(Math.abs(b-a-.1)<1e-9);
 assert.equal(clock.sample().speaking,false);FakeContext.last.currentTime=.08;assert.equal(clock.sample().speaking,true);assert.equal(clock.sample().mouth?.viseme,'REST');
 FakeContext.last.currentTime=.3;assert.equal(clock.sample().drained,true);await clock.close();
});
test('interrupt stops sources and clears future mouth frames',async()=>{
 const clock=new PlaybackClock();await clock.unlock();clock.enqueue(pcm(24000));const source=FakeContext.last.sources[0];clock.interrupt();assert.ok(source.stopped);assert.equal(clock.sample().mouth,null);assert.equal(clock.queuedSeconds,0);
 FakeContext.last.currentTime=5;assert.equal(clock.sample().speaking,false);await clock.close();
});
test('suspended audio does not enqueue stale asynchronous work',async()=>{
 const clock=new PlaybackClock();await clock.unlock();FakeContext.last.state='suspended';assert.throws(()=>clock.enqueue(pcm(200)));assert.equal(FakeContext.last.sources.length,0);await clock.close();
});
test('resampling preserves position across capture chunks',()=>{
 const input=Float32Array.from({length:4410},(_,i)=>Math.sin(i*.07)*.3), whole=new PcmResampler(),split=new PcmResampler();
 const expected=atob(whole.convert(input,44100));let actual='';for(let i=0;i<input.length;i+=137)actual+=atob(split.convert(input.slice(i,i+137),44100));
 assert.equal(actual.length,expected.length);const a=new DataView(Uint8Array.from(actual,c=>c.charCodeAt(0)).buffer),b=new DataView(Uint8Array.from(expected,c=>c.charCodeAt(0)).buffer);for(let i=0;i<a.byteLength;i+=2)assert.ok(Math.abs(a.getInt16(i,true)-b.getInt16(i,true))<=1);
});
