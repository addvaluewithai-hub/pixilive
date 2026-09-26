const test=require('node:test'),assert=require('node:assert/strict');
const {setupMascot}=require('./rig-fixture.cjs');
const tentacles=['base-0','base-1','base-2','base-3','base-4','base-5','l','r'];
const points=f=>tentacles.flatMap(id=>f.$('o-t-'+id).getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number));
const faces=['neutral','happy','sad','crying','surprised','thinking','angry','sleepy','laughing','excited'];
test('Octo has eight vector tentacles, no human limbs, and independently scoped portraits',()=>{
 const f=setupMascot('octo'),svg=f.art.render('octo',{portrait:true,prefix:'octo-picker-'}),ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);for(const m of svg.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(m[1]));
 assert.ok(svg.includes('أوكتو'));assert.ok(!svg.includes('<image'));assert.equal(f.$('m-leg-l'),null);
 for(const id of tentacles){assert.ok(f.$('o-t-'+id));assert.ok(f.$('o-s-'+id+'-2'));}
 assert.equal(f.motion.setFlight({action:'move',x:1,y:0}),false);
});
test('Octo speaks through all expressions and gestures, seals silence, and closes laughter eyes',()=>{
 const f=setupMascot('octo');
 for(const face of faces)for(const gesture of ['none','wave','think','explain','celebrate','blink','jump']){
  f.motion.setEmotion(face);f.motion.setIntensity(.9);f.motion.setGesture(gesture,2);f.motion.setMouthPose({viseme:'AA',energy:.6,open:.8});f.tick(25);
  assert.ok(f.motion.getState().mouthOpen>.75);assert.ok(!/NaN|Infinity/.test(f.svg()));
  f.motion.setMouthPose({viseme:'MBP',energy:.5,open:0});f.tick(12);
  assert.ok(Number(f.$('mouth-fill').getAttribute('opacity'))<.001);assert.equal(Number(f.$('teeth').getAttribute('opacity')),0);
 }
 f.motion.setEmotion('laughing');f.motion.setIntensity(.9);f.tick(80);
 for(const s of ['l','r']){assert.equal(+f.$('m-white-'+s).getAttribute('opacity'),0);assert.equal(+f.$('m-closed-'+s).getAttribute('opacity'),1);}
});
test('every tentacle stays continuous across interrupted poses; suckers stay attached and rest recovers',()=>{
 const f=setupMascot('octo');let previous=points(f),maxStep=0;
 for(let frame=0;frame<380;frame++){
  if(frame===0)f.motion.setGesture('wave',5);if(frame===35)f.motion.setGesture('think',5);if(frame===65)f.motion.setGesture('celebrate',5);if(frame===102)f.motion.setGesture('explain',5);if(frame===137)f.motion.cancelActions();
  f.tick();const now=points(f);assert.equal(now.length,previous.length);
  for(let i=0;i<now.length;i+=2){maxStep=Math.max(maxStep,Math.hypot(now[i]-previous[i],now[i+1]-previous[i+1]));assert.ok(now[i]>80&&now[i]<530&&now[i+1]>120&&now[i+1]<490);}
  for(const s of ['l','r'])for(let i=0;i<3;i++)assert.equal(f.$('o-s-'+s+'-'+i).getAttribute('transform'),f.$('o-front-s-'+s+'-'+i).getAttribute('transform'));
  previous=now;
 }
 assert.ok(maxStep<9,`tentacle displacement per frame: ${maxStep}`);
 const q=f.motion.getState();assert.ok(Math.abs(q.rx-440)<.1&&Math.abs(q.ry-351)<.1);
});
test('Octo reduced motion suppresses idle tentacle drift and jumping while speech and cleanup remain functional',()=>{
 const f=setupMascot('octo',true),before=points(f);f.tick(120);assert.deepEqual(points(f),before);
 f.motion.setGesture('jump',3);f.motion.setMouthPose({viseme:'OH',energy:.7,open:.7});f.tick(35);
 assert.equal(f.motion.getState().lift,0);assert.ok(f.motion.getState().mouthOpen>.65);
 f.motion.destroy();const svg=f.svg();f.tick(30);assert.equal(f.svg(),svg);assert.equal(f.document.listeners.visibilitychange.length,0);assert.equal(f.media.listeners.change.length,0);
});
