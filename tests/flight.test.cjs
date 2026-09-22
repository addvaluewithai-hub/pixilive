const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/character-engine/flight.js'),'utf8'),context);
const {createFlight}=context.module.exports;
const {setup}=require('./rig-fixture.cjs');
const command=(x,y,speed=.5,path='direct',action='move')=>({x,y,speed,path,action});
const advance=(f,seconds=20,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)f.step(dt);return f.state();};
test('direct, upward arc and downward swoop reach bounded destinations at controlled speed',()=>{
 const halfway=[];
 for(const path of ['direct','arc','swoop']){
  const f=createFlight();assert.equal(f.command(command(.9,.62,.5,path)),true);
  let seconds=0,max=0;
  while(f.state().moving&&seconds<20){const before=f.state();const s=f.step(1/60);seconds+=1/60;max=Math.max(max,Math.hypot(s.vx,s.vy));assert.ok(s.x>=0&&s.x<=1&&s.y>=0&&s.y<=1);assert.ok(Math.hypot(s.x-before.x,s.y-before.y)<.007);if(seconds>1&&halfway.length<['direct','arc','swoop'].indexOf(path)+1)halfway.push(s.y);}
  assert.ok(seconds<20);assert.ok(Math.abs(f.state().x-.9)<.003);assert.ok(Math.abs(f.state().y-.62)<.003);assert.ok(max<=.231);
 }
 assert.ok(halfway[1]<halfway[0]-.02);assert.ok(halfway[2]>halfway[0]+.02);
 const slow=createFlight(),fast=createFlight();slow.command(command(1,0,.1));fast.command(command(1,0,1));advance(slow,1);advance(fast,1);assert.ok(fast.state().y<slow.state().y-.02);
});
test('retargeting and hover preserve position and velocity, brake smoothly and remain inside bounds',()=>{
 const f=createFlight();f.command(command(1,0,1));advance(f,1.2);const before=f.state();
 f.command(command(0,1,.1,'swoop'));assert.deepEqual(f.state(),before);
 f.step(1/60);const changed=f.state();assert.ok(Math.hypot(changed.x-before.x,changed.y-before.y)<.008);assert.ok(Math.hypot(changed.vx-before.vx,changed.vy-before.vy)<.04);
 f.command({action:'hover'});assert.equal(f.state().x,changed.x);advance(f,2);assert.equal(f.state().moving,false);assert.ok(Math.hypot(f.state().vx,f.state().vy)<.001);assert.equal(f.state().landed,false);
 for(let i=0;i<1600;i++){if(i%35===0)f.command(command(i%70?0:1,i%105?1:0,.7,'arc'));const s=f.step(1/60);assert.ok(s.x>=0&&s.x<=1&&s.y>=0&&s.y<=1);assert.ok(Number.isFinite(s.bank));}
});
test('landing settles wings; takeoff is continuous; frame rates and reduced motion remain functional',()=>{
 const positions=[];
 for(const dt of [1/30,1/60,1/120]){
  const f=createFlight();f.command(command(.2,0,.5,'direct','land'));const s=advance(f,20,dt);assert.ok(s.y>.997);assert.equal(s.landed,true);assert.ok(s.lift<.001);
  f.command(command(.8,.1,.6,'arc'));assert.equal(f.state().y,s.y);positions.push(advance(f,2,dt));
 }
 assert.ok(Math.abs(positions[0].x-positions[2].x)<.01);
 const f=createFlight();f.command(command(.8,.1));for(let i=0;i<1500;i++)f.step(1/60,true);assert.equal(f.state().moving,false);assert.ok(Math.abs(f.state().x-.8)<.003);assert.equal(f.state().bank,0);
});
test('sprite wings, flight, face and lip sync coexist; face cancellation never stops travel',()=>{
 const f=setup('sprite');assert.equal(f.$('wings').getAttribute('opacity'),'1');assert.equal(f.$('tail').getAttribute('opacity'),'0');
 f.motion.setFlight(command(.9,.1));f.tick(60);const x=f.motion.flightState().x;
 f.motion.setGesture('wave',3);f.motion.setEmotion('thinking');f.motion.setMouthPose({viseme:'AA',energy:.6,open:.7});f.tick(30);
 assert.ok(f.motion.flightState().x>x);assert.ok(f.motion.flightState().moving);assert.ok(f.$('mouth-cut').getAttribute('d').length>0);
 const before=f.motion.flightState();f.motion.cancelActions();assert.deepEqual(f.motion.flightState(),before);f.tick(20);assert.ok(f.motion.flightState().x>before.x);
 f.motion.setMouthPose({viseme:'MBP',energy:.4,open:0});f.tick(30);f.motion.stopFlight();f.tick(120);assert.equal(f.motion.flightState().moving,false);
 const reduced=setup('sprite',true);reduced.motion.setFlight(command(.8,.2));reduced.tick(900);assert.equal(reduced.motion.flightState().moving,false);
 const fox=setup('fox');assert.equal(fox.motion.setFlight(command(1,0)),false);assert.equal(fox.$('wings').getAttribute('opacity'),'0');
});
test('wingbeats keep a continuous phase when speed changes late in a session',()=>{
 const f=setup('sprite');f.tick(3000);
 const spread=()=>Number(/scale\(([-.\d]+)/.exec(f.$('wing-l').getAttribute('transform'))[1]);
 f.motion.setFlight(command(1,0,1));let previous=spread();
 for(let i=0;i<160;i++){if(i===90)f.motion.setFlight(command(0,1,.1));f.tick();const current=spread();assert.ok(Math.abs(current-previous)<.035);previous=current;}
});
