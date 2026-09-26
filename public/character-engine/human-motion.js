/* Human rig. Face/visemes use shared mouth geometry; sleeves follow continuous curves. */
(function(host){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),fmt=v=>+v.toFixed(3);
 const faces={
  neutral:{eye:.94,brow:0,tilt:0,head:-.6,smile:.36},happy:{eye:.96,brow:-1,tilt:0,head:-1,smile:.7},
  sad:{eye:.77,brow:3,tilt:-12,head:3,smile:-.6},crying:{eye:.55,brow:4,tilt:-14,head:3,smile:-.7},
  surprised:{eye:1.2,brow:-8,tilt:0,head:-2,smile:0},thinking:{eye:.85,brow:-2,tilt:-6,head:6,smile:.04},
  angry:{eye:.7,brow:5,tilt:15,head:-2,smile:-.5},sleepy:{eye:.3,brow:2,tilt:-2,head:5,smile:.1},
  laughing:{eye:.05,brow:0,tilt:0,head:-4,smile:.9},excited:{eye:1.15,brow:-6,tilt:0,head:-3,smile:.8}
 };
 const openHand=[[-8,0],[-11,-6],[-15,-15],[-13,-19],[-9,-18],[-5,-12],[-5,-29],[-3,-35],[0,-35],[2,-17],[3,-37],[6,-39],[9,-36],[9,-17],[11,-32],[14,-34],[16,-31],[15,-15],[18,-26],[21,-27],[23,-24],[20,-8],[16,-1],[8,2],[0,2]];
 const relaxedHand=[[-7,3],[-10,-4],[-11,-13],[-11,-17],[-8,-17],[-6,-11],[-6,-26],[-4,-31],[-1,-30],[0,-17],[1,-32],[4,-34],[7,-32],[7,-17],[9,-30],[12,-31],[15,-28],[14,-15],[17,-25],[20,-25],[22,-22],[19,-7],[14,1],[7,3],[0,3]];
 function handShape(openness){
  const pts=relaxedHand.map((p,i)=>p.map((n,j)=>{const rest=j===0?n*.78:n;return rest+(openHand[i][j]-rest)*clamp(openness);}));
  let d=`M${pts[0].map(fmt).join(' ')}`;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+2)%pts.length];d+=` C${fmt(a[0]+(b[0]-prev[0])*.12)} ${fmt(a[1]+(b[1]-prev[1])*.12)} ${fmt(b[0]-(next[0]-a[0])*.12)} ${fmt(b[1]-(next[1]-a[1])*.12)} ${b.map(fmt).join(' ')}`;}
  return d+'Z';
 }
 const radians=degrees=>degrees*Math.PI/180;
 const degrees=angle=>angle*180/Math.PI;
 const lengthsFor=a=>{
  const reach=Math.max(...['l','r'].map(side=>Math.hypot(a.rest[side+'x']-(301+(side==='l'?-1:1)*a.shoulder),a.rest[side+'y']-a.shoulderY)))*1.005;
  return [reach*.5,reach*.5];
 };
 function solvePose(side,x,y,handAngle,anatomy){
  const sign=side==='l'?-1:1,s=[301+sign*anatomy.shoulder,anatomy.shoulderY],lengths=lengthsFor(anatomy);
  const dx=(x-s[0])*sign,dy=y-s[1],distance=clamp(Math.hypot(dx,dy),6,lengths[0]+lengths[1]-.01);
  const direction=Math.atan2(dy,dx),alpha=Math.acos(clamp((lengths[0]**2+distance**2-lengths[1]**2)/(2*lengths[0]*distance),-1,1));
  const upper=direction+alpha,bend=-Math.acos(clamp((distance**2-lengths[0]**2-lengths[1]**2)/(2*lengths[0]*lengths[1]),-1,1));
  const wrist=clamp(handAngle*sign-(degrees(upper+bend)+90),-25,25);
  return {upper:degrees(upper),bend:degrees(bend),wrist};
 }
 function sleeve(side,upper,bend,wrist,anatomy){
  bend=clamp(bend,-175,0);
  const sign=side==='l'?-1:1,s=[301+sign*anatomy.shoulder,anatomy.shoulderY],lengths=lengthsFor(anatomy);
  const u=[Math.cos(radians(upper))*sign,Math.sin(radians(upper))],v=[Math.cos(radians(upper+bend))*sign,Math.sin(radians(upper+bend))];
  const e=s.map((n,i)=>n+u[i]*lengths[0]),w=e.map((n,i)=>n+v[i]*lengths[1]);
  const round=Math.min(...lengths)*.18,a=e.map((n,i)=>n-u[i]*round),b=e.map((n,i)=>n+v[i]*round);
  const points=[];
  const add=(p,t)=>points.push({p,w:anatomy.sleeve+(10-anatomy.sleeve)*t});
  // Two fixed-length bones drive one tapered sleeve with a rounded elbow.
  // The contour has no independent wrist-controlled loop or variable reach.
  for(let i=0;i<=6;i++){const t=i/6;add(s.map((n,j)=>n+(a[j]-n)*t),t*.4);}
  for(let i=1;i<=8;i++){const t=i/8,q=1-t;add(a.map((n,j)=>q*q*n+2*q*t*e[j]+t*t*b[j]),.4+t*.2);}
  for(let i=1;i<=6;i++){const t=i/6;add(b.map((n,j)=>n+(w[j]-n)*t),.6+t*.4);}
  let d='';
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],len=Math.max(.001,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
   const corner=(q,k)=>[fmt(q.p[0]+nx*q.w*k),fmt(q.p[1]+ny*q.w*k)].join(' ');
   d+=`M${corner(a,1)} L${corner(b,1)} L${corner(b,-1)} L${corner(a,-1)}Z`;
   d+=`M${fmt(a.p[0]+a.w)} ${fmt(a.p[1])} a${fmt(a.w)} ${fmt(a.w)} 0 1 0 ${fmt(-a.w*2)} 0 a${fmt(a.w)} ${fmt(a.w)} 0 1 0 ${fmt(a.w*2)} 0Z`;
  }
  const n=[-v[1],v[0]],local=(across,along)=>w.map((p,i)=>fmt(p+n[i]*across+v[i]*along)).join(' ');
  const cuff=`M${local(10,-6)} Q${local(0,-4)} ${local(-10,-6)} L${local(-9.7,0)} Q${local(0,2)} ${local(9.7,0)}Z`;
  const fore=(t,offset=0)=>e.map((p,i)=>fmt(p+v[i]*t+n[i]*offset)).join(' ');
  const fold=`M${fore(7,-8)} Q${fore(12,0)} ${fore(7,8)}`;
  const highlight=`M${fore(17,-3)} Q${fore(lengths[1]*.55,-4)} ${fore(lengths[1]-13,-3)}`;
  const angle=sign*(upper+bend+90+clamp(wrist,-25,25));
  return {d,cuff,fold,highlight,hand:`translate(${w.map(fmt).join(' ')}) rotate(${fmt(angle)}) scale(${anatomy.hand})`,x:w[0],y:w[1],angle,
   joints:{shoulder:s,elbow:e,wrist:w,lengths,upper,bend,wristBend:clamp(wrist,-25,25)}};
 }
 function createRig(root,options={}){
  const Geometry=host.CharacterGeometry,p=host.HumanArt.presets[options.preset];if(!p)throw new Error('Unknown human rig');
  const anatomy=p.anatomy,resting=anatomy.rest;
  const poses={none:{},wave:{},explain:{},think:{},celebrate:{}};
  for(const side of ['l','r']){
   const rest=solvePose(side,resting[side+'x'],resting[side+'y'],resting[side+'a'],anatomy);
   for(const name of Object.keys(poses))poses[name][side]=rest;
  }
  poses.wave.r=solvePose('r',408,227,12,anatomy);
  poses.explain.r=solvePose('r',414,301,65,anatomy);
  poses.think.r=solvePose('r',301+anatomy.shoulder+6,anatomy.shoulderY-3,-40,anatomy);
  poses.celebrate.l=solvePose('l',204,209,-15,anatomy);
  poses.celebrate.r=solvePose('r',397,209,15,anatomy);
  const arms={};
  const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,root.querySelector('#'+id));return nodes.get(id);};
  const attr=(id,k,v)=>$(id)?.setAttribute(k,String(v));
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
  let emotion='neutral',intensity=.7,energy=.1,externalMouth=null,gesture='none',until=0,time=0,last=0,raf=0,disposed=false,blinkStart=-99,nextBlink=3,jumpStart=-99;
  const q={...faces.neutral,...resting,voice:0,jump:0,wave:0,speechHands:0,...Geometry.mouthBase,mouthSmile:faces.neutral.smile};
  for(const side of ['l','r']){const pose=poses.none[side];q[side+'u']=pose.upper;q[side+'b']=pose.bend;q[side+'w']=pose.wrist;}
  const velocity=Object.fromEntries(Object.keys(q).map(k=>[k,0]));
  const smooth=(k,target,dt,omega=11)=>{const x=q[k]-target,v=velocity[k],e=Math.exp(-omega*dt);q[k]=target+(x+(v+omega*x)*dt)*e;velocity[k]=(v-omega*(v+omega*x)*dt)*e;};
  function targets(){
   const face=faces[emotion]||faces.neutral,goal={};for(const k of ['eye','brow','tilt','head','smile'])goal[k]=faces.neutral[k]+(face[k]-faces.neutral[k])*intensity;
   Object.assign(goal,{lo:resting.lo,ro:resting.ro,voice:0,jump:0,wave:0,speechHands:0});
   const active=time<until?gesture:'none',pose=poses[active]||poses.none;
   for(const side of ['l','r']){goal[side+'u']=pose[side].upper;goal[side+'b']=pose[side].bend;goal[side+'w']=pose[side].wrist;}
   if(active==='wave'){goal.ro=1;goal.wave=reduced?0:clamp(1-Math.hypot(q.ru-pose.r.upper,q.rb-pose.r.bend)/30);}
   if(active==='explain')goal.ro=.85;
   if(active==='think')goal.ro=.12;
   if(active==='celebrate'){goal.lo=1;goal.ro=1;}
   const mouth=Geometry.expressionMouth[emotion]||Geometry.mouthBase;
   Object.assign(goal,Geometry.mouthBase,mouth,{mouthOpen:mouth.mouthOpen*intensity||0,mouthSmile:goal.smile});
   if(externalMouth){
    const v=Geometry.visemes[externalMouth.viseme]||Geometry.visemes.REST,voiced=externalMouth.energy>.012&&!['REST','MBP'].includes(externalMouth.viseme);
    Object.assign(goal,v);goal.mouthOpen=voiced?clamp(externalMouth.open):0;
    goal.mouthSmile=voiced?v.mouthSmile:externalMouth.viseme==='MBP'?0:goal.smile;
    if(externalMouth.width!==undefined)goal.mouthWidth=.62+clamp(externalMouth.width)*.54;
    if(externalMouth.round!==undefined)goal.mouthRound=clamp(externalMouth.round);
    goal.voice=reduced?0:clamp(externalMouth.energy*2)*(options.speechMotionScale??.35);
   }
   goal.speechHands=active==='none'?goal.voice:0;
   const jt=time-jumpStart;if(!reduced&&jt>0&&jt<.9)goal.jump=-30*Math.sin(jt/.9*Math.PI);
   return {goal,active};
  }
  function draw(){
   const motion=reduced?0:1,bob=Math.sin(time*1.7)*.6*motion,head=q.head+Math.sin(time*3)*q.voice*1.5;
   attr('h-character','transform',`translate(0 ${fmt(bob+q.jump)})`);
   attr('h-shadow','transform',`translate(304 514) scale(${fmt(1+q.jump*.007)} 1) translate(-304 -514)`);
   for(const id of ['h-head','h-hair-back'])attr(id,'transform',`rotate(${fmt(head)} 301 226) translate(0 ${fmt(-Math.sin(time*3.5)*q.voice*.7)})`);
   let blink=0;const bt=time-blinkStart;if(bt>=0&&bt<.2)blink=Math.sin(bt/.2*Math.PI);
   const openness=clamp(q.eye*(1-blink),.005,1.25),closed=clamp((.13-openness)/.1);
   for(const side of ['l','r']){
    const sign=side==='l'?1:-1,top=25*openness,bottom=18*openness;
    const upper=`M-18 0 C-18 ${fmt(-top)} 18 ${fmt(-top)} 18 0`,d=upper+` C18 ${fmt(bottom)}-18 ${fmt(bottom)}-18 0Z`;
    for(const id of ['h-eye-white-','h-eye-cut-'])attr(id+side,'d',d);
    attr('h-lid-'+side,'d',upper);attr('h-eye-white-'+side,'opacity',1-closed);attr('h-lid-'+side,'opacity',1-closed);attr('h-pupil-'+side,'opacity',1-closed);attr('h-eye-closed-'+side,'opacity',closed);
    attr('h-eye-closed-'+side,'d',`M-17 0 Q0 ${fmt(-8*q.smile)} 17 0`);
    attr('h-brow-'+side,'transform',`translate(0 ${fmt(q.brow)}) rotate(${fmt(sign*q.tilt)} ${side==='l'?272:329} 112)`);
    if(p.female){attr('h-lashes-'+side,'opacity',(1-closed)*clamp(openness/.7));attr('h-lashes-'+side,'transform',`translate(0 ${fmt((1-Math.min(1,openness))*13)})`);}
    const gaze=emotion==='thinking'?2*intensity:0;attr('h-pupil-'+side,'transform',`translate(${fmt(gaze)} ${fmt(-gaze*.5)})`);
   }
   attr('h-tears','opacity',emotion==='crying'?intensity:0);
   const mouth=Geometry.mouth(q,'human');for(const [id,attrs]of Object.entries(mouth.attributes)){if(id==='mouth'||id==='muzzle-smile')continue;for(const [k,v]of Object.entries(attrs))attr(id,k,v);}
   attr('mouth','transform',`translate(${fmt(302+q.mouthOffset*.65)} ${anatomy.mouthY}) scale(${anatomy.mouthScale})`);
   attr('h-lower-lip','opacity',fmt(.3*(1-clamp(q.mouthOpen*5))));
   for(const side of ['l','r']){
    const accent=Math.sin(time*2.5+(side==='l'?0:2))*q.speechHands*motion;
    const wave=side==='r'?q.wave*motion:0;
    const arm=sleeve(side,q[side+'u']+accent*1.6,q[side+'b']+accent*2+Math.sin(time*7)*wave*1.2,q[side+'w']+Math.sin(time*7)*wave*9,anatomy);
    arms[side]=arm.joints;q[side+'x']=arm.x;q[side+'y']=arm.y;q[side+'a']=arm.angle;
    attr('h-palm-'+side,'d',handShape(q[side+'o']));attr('h-fingers-'+side,'opacity',fmt(.24+.24*q[side+'o']));
    attr('h-sleeve-'+side,'d',arm.d);attr('h-cuff-'+side,'d',arm.cuff);attr('h-sleeve-fold-'+side,'d',arm.fold);
    attr('h-sleeve-fold-'+side,'opacity',fmt(.14+.24*clamp(Math.abs(q[side+'b'])/120)));
    attr('h-sleeve-light-'+side,'d',arm.highlight);attr('h-hand-'+side,'transform',arm.hand);
   }
  }

  function frame(ms){if(disposed)return;const dt=last?clamp((ms-last)/1000,0,.05):1/60;last=ms;if(!document.hidden){time+=dt;if(!reduced&&time>nextBlink){blinkStart=time;nextBlink=time+3.4+Math.random()*2;}
   const {goal}=targets();for(const k of Object.keys(goal))smooth(k,goal[k],dt,k==='mouthOpen'&&externalMouth&&['REST','MBP'].includes(externalMouth.viseme)?80:k.startsWith('mouth')?32:['lu','lb','lw','ru','rb','rw'].includes(k)?5.5:['lo','ro','wave','speechHands'].includes(k)?8:11);
   for(const side of ['l','r']){const k=side+'b',limited=clamp(q[k],-175,0);if(limited!==q[k]){q[k]=limited;velocity[k]=0;}}
   draw();}
   raf=requestAnimationFrame(frame);
  }
  const visibility=()=>{last=0;},preference=()=>{reduced=media.matches;};
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);
  draw();raf=requestAnimationFrame(frame);
  return {
   setEmotion:name=>{if(Object.hasOwn(faces,name))emotion=name;},setIntensity:n=>{if(Number.isFinite(n))intensity=clamp(n);},setEnergy:n=>{if(Number.isFinite(n))energy=clamp(n);},
   setMouthPose:value=>{externalMouth=value;},
   setGesture:(name,duration=3)=>{if(!['none','wave','blink','jump','explain','think','celebrate'].includes(name))return;gesture=name;until=time+clamp(Number.isFinite(duration)?duration:3,.1,6);if(name==='blink')blinkStart=time;if(name==='jump')jumpStart=time;},
   cancelActions:()=>{gesture='none';until=0;jumpStart=-99;},setFlight:()=>false,stopFlight:()=>{},flightState:()=>null,
   destroy:()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);},
   getState:()=>({emotion,intensity,energy,gesture:time<until?gesture:'none',disposed,...q,arms:JSON.parse(JSON.stringify(arms))})
  };
 }
 host.HumanMotion={createRig,sleeve,solvePose,handShape};
})(typeof window!=='undefined'?window:this);
