import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceDirector } from '../src/engine-app/core/PerformanceDirector.ts';
import { parseCue } from '../src/engine-app/core/types.ts';
import type { CharacterPort } from '../src/engine-app/core/types.ts';
function fixture() {
  const calls: { name: string; value?: unknown }[] = [];
  const port: CharacterPort = { expression: (value, intensity) => calls.push({ name: 'expression', value: [value, intensity] }), gesture: value => calls.push({ name: 'gesture', value }), mouth: value => calls.push({ name: 'mouth', value }), mode: value => calls.push({ name: 'mode', value }), cancel: () => calls.push({ name: 'cancel' }), destroy: () => calls.push({ name: 'destroy' }) };
  return { calls, port };
}
const cue = { id: 'beat-1', turn: 1, at: 10, expression: 'surprised' as const, gesture: 'wave' as const, intensity: .6, duration: 2 };
test('cue waits for audible clock, expires, and is never replayed', () => {
  const d = new PerformanceDirector(), f = fixture(); d.attach(f.port); d.beginTurn(1); f.calls.length = 0;
  d.enqueue(cue); d.tick(9.9, null, false); assert.equal(f.calls.some(c => c.name === 'gesture'), false);
  d.tick(10, null, true); assert.equal(f.calls.filter(c => c.name === 'gesture').length, 1);
  d.enqueue(cue); d.tick(11, null, true); assert.equal(f.calls.filter(c => c.name === 'gesture').length, 1);
  d.tick(12.1, null, false); assert.equal(d.snapshot().active, null);
});
test('interruption cancels queued beats and rejects old turns', () => {
  const d = new PerformanceDirector(), f = fixture(); d.attach(f.port); d.beginTurn(1); d.enqueue(cue); d.interrupt(); d.beginTurn(2); d.enqueue(cue); f.calls.length = 0; d.tick(11, null, false);
  assert.equal(d.snapshot().queued, 0); assert.equal(f.calls.some(c => c.name === 'gesture'), false);
});
test('skin switch cleans old rig and gestures while preserving conversation mode', () => {
  const d = new PerformanceDirector(), old = fixture(), next = fixture(); d.attach(old.port); d.beginTurn(1); d.mode('speaking'); d.enqueue(cue); d.attach(next.port);
  assert.equal(d.snapshot().mode, 'speaking'); assert.equal(d.snapshot().queued, 0); assert.ok(old.calls.some(c => c.name === 'destroy'));
  d.tick(11, { viseme: 'AA', open: .7, energy: .5 }, true); assert.equal(next.calls.some(c => c.name === 'gesture'), false);
  assert.ok(next.calls.some(c => c.name === 'mouth' && (c.value as {viseme:string})?.viseme === 'AA'));
});
test('tool cancellation removes pending and active directions', () => {
  const d = new PerformanceDirector(), f = fixture(); d.attach(f.port); d.beginTurn(1); d.enqueue(cue); d.cancelCalls(['beat-1']); d.tick(10, null, false); assert.equal(d.snapshot().active, null);
  d.enqueue({ ...cue, id: 'beat-2' }); d.tick(10, null, true); d.cancelCalls(['beat-2']); assert.equal(d.snapshot().active, null);
});
test('invalid cues and unsafe numbers are rejected or bounded', () => {
  assert.equal(parseCue({ expression: '__proto__' }), null); assert.equal(parseCue({ expression: 'happy', intensity: NaN }), null);
  assert.deepEqual(parseCue({ expression: 'sad', intensity: 100, duration: -20 }), { expression: 'sad', gesture: 'none', intensity: 1, duration: .6 });
});
test('hidden-tab catch-up does not burst stale gestures', () => {
  const d = new PerformanceDirector(), f = fixture(); d.attach(f.port); d.beginTurn(1); f.calls.length = 0;
  for(let i=0;i<10;i++)d.enqueue({...cue,id:`cue-${i}`,at:i}); d.tick(20,null,false);
  assert.equal(f.calls.some(c=>c.name==='gesture'),false);
});
test('generation boundaries preserve performance already scheduled against buffered audio',()=>{
 const reports:any[]=[];const d=new PerformanceDirector(e=>reports.push(e)),f=fixture();d.attach(f.port);d.beginTurn(1);
 d.enqueue(cue);d.tick(10,null,true);d.enqueue({...cue,id:'later',at:13});
 d.beginTurn(2,true);assert.equal(d.snapshot().active,'beat-1');assert.equal(d.snapshot().queued,1);
 assert.equal(reports.some(e=>e.status==='cancelled'),false);
 d.tick(13,null,true);assert.equal(d.snapshot().active,'later');
 d.interrupt('server_interrupted');assert.equal(d.snapshot().active,null);assert.equal(reports.at(-1).reason,'server_interrupted');
});
test('expression-only cue cancels an incompatible old gesture',()=>{
 const d=new PerformanceDirector(),f=fixture();d.attach(f.port);d.beginTurn(1);d.enqueue(cue);d.tick(10,null,true);f.calls.length=0;
 d.enqueue({...cue,id:'sad',at:12,expression:'sad',gesture:'none'});d.tick(12,null,true);
 assert.ok(f.calls.some(c=>c.name==='cancel'));assert.equal(f.calls.some(c=>c.name==='gesture'),false);
 assert.ok(f.calls.some(c=>c.name==='expression'&&(c.value as string[])[0]==='sad'));
});
test('gesture hold receives only the remaining duration on the playback clock',()=>{
 const d=new PerformanceDirector(),f=fixture();let hold=0;f.port.gesture=(_g,duration)=>{hold=duration!;};
 d.attach(f.port);d.beginTurn(1);d.enqueue({...cue,duration:5});d.tick(11,null,true);assert.equal(hold,4);
});
