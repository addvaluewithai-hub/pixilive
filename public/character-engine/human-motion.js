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
 function sleeve(side,x,y,angle=side==='l'?-169:171,anatomy={shoulder:55,shoulderY:263,sleeve:18,hand:1}){
  const sign=side==='l'?-1:1,s=[301+sign*anatomy.shoulder,anatomy.shoulderY];
  const dx=x-s[0],dy=y-s[1],distance=Math.hypot(dx,dy),reach=132;
  if(distance>reach){x=s[0]+dx*reach/distance;y=s[1]+dy*reach/distance;}
  // The pose owns wrist orientation; the sleeve follows it with the same tangent.
  // This avoids both the old inward resting palms and the discontinuous x-threshold flip.
  const radians=angle*Math.PI/180,tangent=[Math.sin(radians),-Math.cos(radians)];
  const lift=clamp((350-y)/110),folded=clamp((85-distance)/65),handle=clamp(distance*.25,15,31)+folded*34;
  // A wrist close to its shoulder still needs room for a bent upper arm and elbow.
  const c1=[s[0]+sign*(20+24*lift+20*folded),s[1]+34+17*lift+78*folded],c2=[x-tangent[0]*handle,y-tangent[1]*handle];
  const points=[];
  for(let i=0;i<=16;i++){
   const t=i/16,u=1-t;
   const p=[u*u*u*s[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*x,u*u*u*s[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*y];
   const v=[3*u*u*(c1[0]-s[0])+6*u*t*(c2[0]-c1[0])+3*t*t*(x-c2[0]),3*u*u*(c1[1]-s[1])+6*u*t*(c2[1]-c1[1])+3*t*t*(y-c2[1])],len=Math.max(.01,Math.hypot(...v));
   points.push({p,n:[-v[1]/len,v[0]/len],w:anatomy.sleeve+(10-anatomy.sleeve)*t+1.3*Math.sin(t*Math.PI)});
  }
  const n=points.at(-1).n,u=[n[1],-n[0]];
  // Union of tapered strips and round joins: an offset outline can invert at a
  // tightly bent elbow. Every subpath has the same winding and shares one paint.
  let d='';
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],len=Math.max(.001,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
   const corner=(q,k)=>[fmt(q.p[0]+nx*q.w*k),fmt(q.p[1]+ny*q.w*k)].join(' ');
   d+=`M${corner(a,1)} L${corner(b,1)} L${corner(b,-1)} L${corner(a,-1)}Z`;
   d+=`M${fmt(a.p[0]+a.w)} ${fmt(a.p[1])} a${fmt(a.w)} ${fmt(a.w)} 0 1 0 ${fmt(-a.w*2)} 0 a${fmt(a.w)} ${fmt(a.w)} 0 1 0 ${fmt(a.w*2)} 0Z`;
  }
  const local=(across,along)=>[fmt(x+n[0]*across+u[0]*along),fmt(y+n[1]*across+u[1]*along)].join(' ');
  // A curved cuff overlaps the wrist; no exposed joint or rectangular cut through the palm.
  const cuff=`M${local(10,-6)} Q${local(0,-4)} ${local(-10,-6)} L${local(-9.7,0)} Q${local(0,2)} ${local(9.7,0)}Z`;
  const elbow=points[9],fold=`M${fmt(elbow.p[0]+elbow.n[0]*8)} ${fmt(elbow.p[1]+elbow.n[1]*8)} q${fmt(-elbow.n[0]*9+u[0]*3)} ${fmt(-elbow.n[1]*9+u[1]*3)} ${fmt(-elbow.n[0]*13)} ${fmt(-elbow.n[1]*13)}`;
  return {d,cuff,fold,highlight:`M${s[0]+sign*5} ${s[1]+8} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${fmt(x-u[0]*16)} ${fmt(y-u[1]*16)}`,hand:`translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(angle)}) scale(${anatomy.hand})`};
 }
 function createRig(root,options={}){
  const Geometry=host.CharacterGeometry,p=host.HumanArt.presets[options.preset];if(!p)throw new Error('Unknown human rig');
  const anatomy=p.anatomy,resting=anatomy.rest;
  const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,root.querySelector('#'+id));return nodes.get(id);};
  const attr=(id,k,v)=>$(id)?.setAttribute(k,String(v));
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
  let emotion='neutral',intensity=.7,energy=.1,externalMouth=null,gesture='none',until=0,time=0,last=0,raf=0,disposed=false,blinkStart=-99,nextBlink=3,jumpStart=-99;
  const q={...faces.neutral,...resting,voice:0,jump:0,...Geometry.mouthBase,mouthSmile:faces.neutral.smile};
  const velocity=Object.fromEntries(Object.keys(q).map(k=>[k,0]));
  const smooth=(k,target,dt,omega=11)=>{const x=q[k]-target,v=velocity[k],e=Math.exp(-omega*dt);q[k]=target+(x+(v+omega*x)*dt)*e;velocity[k]=(v-omega*(v+omega*x)*dt)*e;};
  function targets(){
   const face=faces[emotion]||faces.neutral,goal={};for(const k of ['eye','brow','tilt','head','smile'])goal[k]=faces.neutral[k]+(face[k]-faces.neutral[k])*intensity;
   Object.assign(goal,{...resting,voice:0,jump:0});
   const active=time<until?gesture:'none';
   if(active==='wave'){goal.rx=408;goal.ry=227;goal.ra=12;goal.ro=1;}
   if(active==='explain'){goal.rx=414;goal.ry=301;goal.ra=65;goal.ro=.85;}
   if(active==='think'){goal.rx=342;goal.ry=250;goal.ra=-25;goal.ro=.12;}
   if(active==='celebrate'){goal.lx=204;goal.ly=209;goal.rx=397;goal.ry=209;goal.la=-15;goal.ra=15;goal.lo=1;goal.ro=1;}
   for(const k of ['la','ra'])goal[k]+=360*Math.round((q[k]-goal[k])/360);
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
   const jt=time-jumpStart;if(!reduced&&jt>0&&jt<.9)goal.jump=-30*Math.sin(jt/.9*Math.PI);
   return {goal,active};
  }
  function draw(active){
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
    let x=q[side+'x'],y=q[side+'y'];
    if(active==='wave'&&side==='r'){const arrival=clamp(1-Math.hypot(x-408,y-227)/28);x+=Math.sin(time*7)*4*arrival*motion;}
    if(active==='none'){x+=Math.sin(time*2.5+(side==='l'?0:2))*q.voice*3;y-=q.voice*(1+Math.sin(time*3))*3;}
    if(active==='think'&&side==='r'){
     const a=head*Math.PI/180,weight=clamp(1-Math.hypot(x-342,y-250)/35),dx=x-301,dy=y-226;
     x+=(301+dx*Math.cos(a)-dy*Math.sin(a)-x)*weight;y+=(226+dx*Math.sin(a)+dy*Math.cos(a)-y)*weight;
    }
    const arm=sleeve(side,x,y,q[side+'a'],anatomy);attr('h-palm-'+side,'d',handShape(q[side+'o']));attr('h-fingers-'+side,'opacity',fmt(.24+.24*q[side+'o']));attr('h-sleeve-'+side,'d',arm.d);attr('h-cuff-'+side,'d',arm.cuff);attr('h-sleeve-fold-'+side,'d',arm.fold);attr('h-sleeve-light-'+side,'d',arm.highlight);attr('h-hand-'+side,'transform',arm.hand);
   }
  }
  function frame(ms){if(disposed)return;const dt=last?clamp((ms-last)/1000,0,.05):1/60;last=ms;if(!document.hidden){time+=dt;if(!reduced&&time>nextBlink){blinkStart=time;nextBlink=time+3.4+Math.random()*2;}
   const {goal,active}=targets();for(const k of Object.keys(goal))smooth(k,goal[k],dt,k==='mouthOpen'&&externalMouth&&['REST','MBP'].includes(externalMouth.viseme)?80:k.startsWith('mouth')?32:['lx','ly','rx','ry','la','ra','lo','ro'].includes(k)?7:11);draw(active);}
   raf=requestAnimationFrame(frame);
  }
  const visibility=()=>{last=0;},preference=()=>{reduced=media.matches;};
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);
  draw('none');raf=requestAnimationFrame(frame);
  return {
   setEmotion:name=>{if(Object.hasOwn(faces,name))emotion=name;},setIntensity:n=>{if(Number.isFinite(n))intensity=clamp(n);},setEnergy:n=>{if(Number.isFinite(n))energy=clamp(n);},
   setMouthPose:value=>{externalMouth=value;},
   setGesture:(name,duration=3)=>{if(!['none','wave','blink','jump','explain','think','celebrate'].includes(name))return;gesture=name;until=time+clamp(Number.isFinite(duration)?duration:3,.1,6);if(name==='blink')blinkStart=time;if(name==='jump')jumpStart=time;},
   cancelActions:()=>{gesture='none';until=0;jumpStart=-99;},setFlight:()=>false,stopFlight:()=>{},flightState:()=>null,
   destroy:()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);},
   getState:()=>({emotion,intensity,energy,gesture:time<until?gesture:'none',disposed,...q})
  };
 }
 host.HumanMotion={createRig,sleeve,handShape};
})(typeof window!=='undefined'?window:this);
