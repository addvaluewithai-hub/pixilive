const test=require('node:test'),assert=require('node:assert/strict');
const {setupHuman}=require('./rig-fixture.cjs');
const names=['hakim','reem','marwan','amal'];
const expressions=['neutral','happy','sad','crying','surprised','thinking','angry','sleepy','laughing','excited'];
const gestures=['wave','think','explain','celebrate','blink','jump','none'];
const hand=f=>{const m=/translate\(([-.\d]+) ([-.\d]+)\)/.exec(f.$('h-hand-r').getAttribute('transform'));return [Number(m[1]),Number(m[2])];};
test('four human presets render distinct vector identities and safe reusable portraits',()=>{
 const f=setupHuman();
 for(const name of names){
  const svg=f.art.render(name,{portrait:true,prefix:`card-${name}-`});
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const m of svg.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(m[1]));
  assert.ok(svg.includes('viewBox="211 34 180 212"'));assert.ok(svg.includes(f.art.presets[name].name));assert.ok(!svg.includes('<image'));assert.ok(!svg.includes('<script'));
 }
 assert.throws(()=>f.art.render('unknown'));assert.throws(()=>f.art.render('reem',{prefix:'" onload="alert(1)'}));
 assert.equal(f.art.presets.hakim.glasses,true);assert.equal(f.art.presets.marwan.hairStyle,'curly');assert.equal(f.art.presets.reem.hairStyle,'long');assert.equal(f.art.presets.amal.headset,true);
});
test('all human expressions and gestures remain finite and preserve mouth closure',()=>{
 for(const name of names){const f=setupHuman(name);
  for(const expression of expressions){f.motion.setEmotion(expression);f.motion.setIntensity(.8);
   for(const gesture of gestures){f.motion.setGesture(gesture,.8);f.motion.setMouthPose({viseme:'REST',open:0,energy:0});f.tick(25);
    const s=f.motion.getState();assert.ok(Number.isFinite(s.rx)&&Number.isFinite(s.ry));assert.ok(!/NaN|Infinity/.test(f.svg()));assert.ok(Number(f.$('mouth-fill').getAttribute('opacity'))<.001);
    assert.ok(f.$('h-sleeve-r').getAttribute('d').endsWith('Z'));
   }
  }
  assert.equal(f.motion.setFlight({action:'move',x:0,y:0}),false);
 }
});
test('mid-gesture replacement, cancellation and expiry preserve hand continuity and recover rest pose',()=>{
 const f=setupHuman('reem');let previous=hand(f),maximum=0;
 for(let i=0;i<330;i++){
  if(i===0)f.motion.setGesture('wave',4);
  if(i===22)f.motion.setGesture('think',4);
  if(i===46)f.motion.setGesture('celebrate',4);
  if(i===70)f.motion.cancelActions();
  f.tick();const now=hand(f);maximum=Math.max(maximum,Math.hypot(now[0]-previous[0],now[1]-previous[1]));previous=now;
 }
 assert.ok(maximum<8,`largest hand step: ${maximum}`);assert.ok(Math.abs(previous[0]-365)<.1);assert.ok(Math.abs(previous[1]-378)<.1);
 f.motion.setGesture('explain',.7);f.tick(170);assert.equal(f.motion.getState().gesture,'none');assert.ok(Math.abs(f.motion.getState().rx-365)<.1);
});
test('shared human visemes close MBP completely, stay inside the mouth clip, and run alongside gestures',()=>{
 const f=setupHuman('hakim');f.motion.setGesture('wave',6);
 for(const viseme of Object.keys(f.geometry.visemes)){
  f.motion.setMouthPose({viseme,energy:.7,open:viseme==='REST'||viseme==='MBP'?0:.65});f.tick(45);
  const s=f.motion.getState();assert.ok(s.mouthOpen>=0&&s.mouthOpen<=1);assert.ok(!/NaN|Infinity/.test(f.svg()));
  assert.equal(f.$('mouth').getAttribute('transform').includes('195'),true);
  if(viseme==='REST'||viseme==='MBP'){assert.ok(Number(f.$('mouth-fill').getAttribute('opacity'))<.001);assert.equal(Number(f.$('teeth').getAttribute('opacity')),0);}
 }
});
test('thinking keeps fingertips below speech area; hair follows head as a separate back layer',()=>{
 const f=setupHuman('amal');f.motion.setEmotion('thinking');f.motion.setGesture('think',6);f.tick(120);
 const [x,y]=hand(f);assert.ok(x>320&&x<365);assert.ok(y>240);assert.equal(f.$('h-head').getAttribute('transform'),f.$('h-hair-back').getAttribute('transform'));
});
test('reduced motion still speaks and gestures; disposed rigs stop and remove listeners',()=>{
 const f=setupHuman('marwan',true);f.motion.setGesture('jump',2);f.motion.setMouthPose({viseme:'AA',energy:.7,open:.8});f.tick(40);
 assert.equal(f.motion.getState().jump,0);assert.ok(f.motion.getState().mouthOpen>.7);
 f.motion.setGesture('explain',2);f.tick(60);assert.ok(f.motion.getState().rx>390);
 f.motion.destroy();const svg=f.svg();f.tick(100);assert.equal(f.svg(),svg);assert.equal(f.document.listeners.visibilitychange.length,0);assert.equal(f.media.listeners.change.length,0);
});
test('resting hands hang outside the torso and wrist angles never flip during interrupted gestures',()=>{
 const f=setupHuman('hakim');f.tick(60);let prev=f.motion.getState();
 assert.ok(prev.lx<248&&prev.rx>352);assert.ok(prev.ly>370&&prev.ry>370);
 for(const side of ['l','r']){assert.ok(-Math.cos(prev[side+'a']*Math.PI/180)>.95);assert.equal(prev[side+'o'],0);}
 let peak=0;
 for(let i=0;i<420;i++){
  if(i%45===0)f.motion.setGesture(['wave','think','explain','celebrate','none'][Math.floor(i/45)%5],3);
  if(i===290)f.motion.cancelActions();
  f.tick();const q=f.motion.getState();
  for(const side of ['l','r']){peak=Math.max(peak,Math.abs(q[side+'a']-prev[side+'a']));assert.ok(q[side+'o']>=0&&q[side+'o']<=1.001);}
  prev=q;
 }
 assert.ok(peak<10,`wrist change per frame ${peak}`);
 f.motion.cancelActions();f.tick(200);assert.ok(f.motion.getState().ro<.001);assert.ok(-Math.cos(f.motion.getState().ra*Math.PI/180)>.95);
});
