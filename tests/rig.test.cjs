const test=require('node:test'),assert=require('node:assert/strict'),{setup}=require('./rig-fixture.cjs');
test('five families keep arms independent of emotion and lips closed during silence',()=>{
 for(const species of ['fox','cat','rabbit','bear','sprite']){
  const a=setup(species);a.motion.setMouthPose({viseme:'REST',energy:0,open:0});a.tick(100);
  for(const expression of ['happy','sad','crying','surprised','thinking','angry','sleepy','laughing','excited']){
   a.motion.setEmotion(expression);a.tick(70);assert.ok(!/NaN|Infinity|undefined/.test(a.svg()));
   assert.equal(a.motion.getState().arms.r.y,414);assert.equal(a.$('mouth-fill').getAttribute('opacity'),'0');
  }a.motion.destroy();
 }
});
test('interrupted gestures and cancellation remain continuous',()=>{
 const a=setup();let previous=a.motion.getState().arms.r,max=0;
 for(let i=0;i<260;i++){
  if(i===0)a.motion.setGesture('wave');if(i===23)a.motion.setGesture('think');if(i===41)a.motion.cancelActions();
  a.tick();const next=a.motion.getState().arms.r;max=Math.max(max,Math.hypot(next.x-previous.x,next.y-previous.y));assert.ok(max<9);previous=next;
 }assert.ok(Math.abs(previous.y-414)<.01);a.motion.destroy();
});
test('MBP closure hides cavity and teeth after an open vowel',()=>{
 const a=setup();a.motion.setMouthPose({viseme:'AA',energy:.7,open:.9});a.tick(50);assert.equal(a.$('mouth-fill').getAttribute('opacity'),'1');
 a.motion.setMouthPose({viseme:'MBP',energy:.7,open:.8});a.tick(12);assert.equal(a.$('mouth-fill').getAttribute('opacity'),'0');assert.equal(a.$('teeth').getAttribute('opacity'),'0');a.motion.destroy();
});
test('recipe rendering produces unique ids and escapes names',()=>{
 const a=setup();for(const species of ['fox','cat','rabbit','bear','sprite']){const svg=a.engine.render({species,name:'<script>bad</script>'});assert.ok(!svg.includes('<script>'));const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);}a.motion.destroy();
});
test('speech accents follow audible energy, yield to explicit hands, and settle in silence',()=>{
 for(const species of ['fox','cat','rabbit','bear','sprite']){
  const a=setup(species);a.motion.setMouthPose({viseme:'AA',energy:.5,open:.6});a.tick(60);
  assert.ok(a.motion.getState().presence.voice>.8);assert.ok(a.motion.getState().presence.hands>.8);
  a.motion.setGesture('think',4);a.tick(70);assert.ok(a.motion.getState().presence.hands<.001);assert.ok(a.motion.getState().presence.voice>.8);
  a.tick(80);assert.ok(Math.abs(a.motion.getState().arms.r.y-322)<.01); // Still held after the old two-second limit.
  a.motion.cancelActions();a.motion.setMouthPose({viseme:'REST',energy:0,open:0});a.tick(150);
  assert.ok(a.motion.getState().presence.voice<.001);assert.ok(a.motion.getState().presence.hands<.001);assert.ok(Math.abs(a.motion.getState().arms.r.y-414)<.01);
  assert.ok(!/NaN|Infinity|undefined/.test(a.svg()));a.motion.destroy();
 }
});
test('speech accents are restrained for sad scenes and disabled with reduced motion',()=>{
 const a=setup();a.motion.setMouthPose({viseme:'AA',energy:.7,open:.6});a.motion.setEmotion('sad');a.tick(100);
 assert.ok(a.motion.getState().presence.voice<=.251);a.motion.destroy();
 const b=setup('fox',true);b.motion.setMouthPose({viseme:'AA',energy:.7,open:.6});b.tick(100);
 assert.equal(b.motion.getState().presence.voice,0);assert.equal(b.motion.getState().presence.hands,0);b.motion.destroy();
});
