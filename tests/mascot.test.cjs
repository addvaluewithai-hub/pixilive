const test=require('node:test'),assert=require('node:assert/strict');
const {setupMascot}=require('./rig-fixture.cjs');
const expressions=['neutral','happy','sad','crying','surprised','thinking','angry','sleepy','laughing','excited'];
const gestures=['none','wave','think','explain','celebrate','blink','jump'];
const hand=f=>{const m=/translate\(([-.\d]+) ([-.\d]+)\)/.exec(f.$('hand-r').getAttribute('transform'));return [+m[1],+m[2]];};
test('mascot has a self-contained vector portrait with scoped references and validated identity',()=>{
 const f=setupMascot(),svg=f.art.render('fustuq',{portrait:true,prefix:'picker-'}),ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);for(const m of svg.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(m[1]));
 assert.ok(svg.includes('فستق'));assert.ok(!svg.includes('<image'));assert.throws(()=>f.art.render('__proto__'));assert.throws(()=>f.art.render('fustuq',{prefix:'" onload="bad'}));
});
test('all mascot expressions and existing gestures run with speech, then seal the mouth in silence',()=>{
 const f=setupMascot();
 for(const emotion of expressions)for(const gesture of gestures){
  f.motion.setEmotion(emotion);f.motion.setIntensity(.85);f.motion.setGesture(gesture,2);f.motion.setMouthPose({viseme:'AA',open:.7,energy:.6});f.tick(30);
  assert.ok(f.motion.getState().mouthOpen>.65);assert.ok(!/NaN|Infinity/.test(f.svg()));
  f.motion.setMouthPose({viseme:'MBP',open:0,energy:.5});f.tick(15);assert.ok(Number(f.$('mouth-fill').getAttribute('opacity'))<.001);assert.equal(Number(f.$('teeth').getAttribute('opacity')),0);
 }
 f.motion.setEmotion('neutral');f.motion.setIntensity(0);f.motion.setMouthPose({viseme:'REST',open:0,energy:0});f.tick(40);assert.ok(f.motion.getState().mouthSmile>.5);
 assert.equal(f.motion.setFlight({action:'move',x:1,y:0}),false);
});
test('mascot changes gestures without hand pops and returns from interruption to the resting pose',()=>{
 const f=setupMascot();let previous=hand(f),peak=0;
 for(let i=0;i<340;i++){
  if(i===0)f.motion.setGesture('wave',5);if(i===32)f.motion.setGesture('think',5);if(i===68)f.motion.setGesture('celebrate',5);if(i===104)f.motion.cancelActions();
  f.tick();const now=hand(f);peak=Math.max(peak,Math.hypot(now[0]-previous[0],now[1]-previous[1]));previous=now;
 }
 assert.ok(peak<7,`hand step ${peak}`);assert.ok(Math.abs(previous[0]-411)<.1&&Math.abs(previous[1]-331)<.1);assert.ok(f.motion.getState().frontR<.001);
});
test('jump includes anticipation and landing while reduced motion suppresses the hop and preserves speech',()=>{
 const f=setupMascot();f.motion.setGesture('jump',3);f.tick(9);assert.ok(f.motion.getState().squash<.97);
 f.tick(22);assert.ok(f.motion.getState().lift<-35);f.tick(100);assert.ok(Math.abs(f.motion.getState().lift)<.1);assert.ok(Math.abs(f.motion.getState().squash-1)<.01);
 const reduced=setupMascot('fustuq',true);reduced.motion.setGesture('jump',2);reduced.motion.setMouthPose({viseme:'AA',open:.8,energy:.8});reduced.tick(40);assert.equal(reduced.motion.getState().lift,0);assert.ok(reduced.motion.getState().mouthOpen>.75);
 reduced.motion.destroy();const svg=reduced.svg();reduced.tick(30);assert.equal(reduced.svg(),svg);assert.equal(reduced.document.listeners.visibilitychange.length,0);assert.equal(reduced.media.listeners.change.length,0);
});
test('laughing closes both eyes cleanly and thinking keeps the foreground paw beside the mouth',()=>{
 const f=setupMascot();f.motion.setEmotion('laughing');f.motion.setIntensity(.9);f.tick(90);
 for(const side of ['l','r']){assert.equal(Number(f.$('m-white-'+side).getAttribute('opacity')),0);assert.equal(Number(f.$('m-pupil-'+side).getAttribute('opacity')),0);assert.equal(Number(f.$('m-closed-'+side).getAttribute('opacity')),1);}
 f.motion.setGesture('think',5);f.tick(120);const [x,y]=hand(f);assert.ok(x>=354&&y>=306&&y<310);assert.ok(Number(f.$('m-fore-r').getAttribute('opacity'))>.99);
});
