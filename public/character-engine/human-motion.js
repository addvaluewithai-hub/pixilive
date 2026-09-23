/* Human rig. Face/visemes use shared mouth geometry; sleeves follow continuous curves. */
(function(host){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),fmt=v=>+v.toFixed(3);
 const faces={
  neutral:{eye:1,brow:0,tilt:0,head:0,smile:.18},happy:{eye:.96,brow:-1,tilt:0,head:-1,smile:.7},
  sad:{eye:.77,brow:3,tilt:-12,head:3,smile:-.6},crying:{eye:.55,brow:4,tilt:-14,head:3,smile:-.7},
  surprised:{eye:1.2,brow:-8,tilt:0,head:-2,smile:0},thinking:{eye:.85,brow:-2,tilt:-6,head:6,smile:.04},
  angry:{eye:.7,brow:5,tilt:15,head:-2,smile:-.5},sleepy:{eye:.3,brow:2,tilt:-2,head:5,smile:.1},
  laughing:{eye:.05,brow:0,tilt:0,head:-4,smile:.9},excited:{eye:1.15,brow:-6,tilt:0,head:-3,smile:.8}
 };
 function sleeve(side,x,y){
  const sign=side==='l'?-1:1,s=[300+sign*52,263];
  const dx=x-s[0],dy=y-s[1],distance=Math.hypot(dx,dy),reach=132;
  if(distance>reach){x=s[0]+dx*reach/distance;y=s[1]+dy*reach/distance;}
  const c1=[s[0]+sign*21,290],c2=[x+(sign*(x-s[0])>15?-sign*15:sign*23),Math.max(279,y+10)],end=[x,y];
  const points=[];
  for(let i=0;i<=16;i++){
   const t=i/16,u=1-t;
   const p=[u*u*u*s[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*x,u*u*u*s[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*y];
   const v=[3*u*u*(c1[0]-s[0])+6*u*t*(c2[0]-c1[0])+3*t*t*(x-c2[0]),3*u*u*(c1[1]-s[1])+6*u*t*(c2[1]-c1[1])+3*t*t*(y-c2[1])],len=Math.max(.01,Math.hypot(...v));
   points.push({p,n:[-v[1]/len,v[0]/len],w:16.5-6*t});
  }
  const n=points.at(-1).n,u=[-n[1],n[0]],angle=Math.atan2(y-c2[1],x-c2[0])*180/Math.PI+90;
  const edge=(q,side)=>[q.p[0]+q.n[0]*q.w*side,q.p[1]+q.n[1]*q.w*side];
  const smooth=pts=>pts.map((p,i)=>{if(!i)return `M${p.map(fmt).join(' ')}`;const a=pts[i-1],prev=pts[Math.max(0,i-2)],next=pts[Math.min(pts.length-1,i+1)];return ` C${fmt(a[0]+(p[0]-prev[0])/6)} ${fmt(a[1]+(p[1]-prev[1])/6)} ${fmt(p[0]-(next[0]-a[0])/6)} ${fmt(p[1]-(next[1]-a[1])/6)} ${fmt(p[0])} ${fmt(p[1])}`;}).join('');
  const left=points.map(q=>edge(q,1)),right=points.map(q=>edge(q,-1)).reverse();
  const d=smooth(left)+` L${right[0].map(fmt).join(' ')}`+smooth(right).replace(/^M[^C]+/,'')+` Q${s[0]-sign*16} ${s[1]-18} ${left[0].map(fmt).join(' ')}Z`;
  const a=[x+n[0]*10,y+n[1]*10],b=[x-n[0]*10,y-n[1]*10];
  const cuff=`M${a.map(fmt).join(' ')} L${b.map(fmt).join(' ')} l${fmt(-u[0]*7)} ${fmt(-u[1]*7)} l${fmt(n[0]*20)} ${fmt(n[1]*20)}Z`;
  return {d,cuff,highlight:`M${s[0]+sign*5} 270 C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${fmt(x-u[0]*14)} ${fmt(y-u[1]*14)}`,hand:`translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(angle)}) scale(.85) translate(0 -14)`};
 }
 function createRig(root,options={}){
  const Geometry=host.CharacterGeometry,p=host.HumanArt.presets[options.preset];if(!p)throw new Error('Unknown human rig');
  const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,root.querySelector('#'+id));return nodes.get(id);};
  const attr=(id,k,v)=>$(id)?.setAttribute(k,String(v));
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
  let emotion='neutral',intensity=.7,energy=.1,externalMouth=null,gesture='none',until=0,time=0,last=0,raf=0,disposed=false,blinkStart=-99,nextBlink=3,jumpStart=-99;
  const q={eye:1,brow:0,tilt:0,head:0,smile:.18,lx:263,ly:354,rx:338,ry:354,voice:0,jump:0,...Geometry.mouthBase};
  const velocity=Object.fromEntries(Object.keys(q).map(k=>[k,0]));
  const smooth=(k,target,dt,omega=11)=>{const x=q[k]-target,v=velocity[k],e=Math.exp(-omega*dt);q[k]=target+(x+(v+omega*x)*dt)*e;velocity[k]=(v-omega*(v+omega*x)*dt)*e;};
  function targets(){
   const face=faces[emotion]||faces.neutral,goal={};for(const k of ['eye','brow','tilt','head','smile'])goal[k]=faces.neutral[k]+(face[k]-faces.neutral[k])*intensity;
   Object.assign(goal,{lx:263,ly:354,rx:338,ry:354,voice:0,jump:0});
   const active=time<until?gesture:'none';
   if(active==='wave'){goal.rx=408;goal.ry=227;}
   if(active==='explain'){goal.rx=414;goal.ry=301;}
   if(active==='think'){goal.rx=342;goal.ry=250;}
   if(active==='celebrate'){goal.lx=204;goal.ly=209;goal.rx=397;goal.ry=209;}
   const mouth=Geometry.expressionMouth[emotion]||Geometry.mouthBase;
   Object.assign(goal,Geometry.mouthBase,mouth,{mouthOpen:mouth.mouthOpen*intensity||0});
   if(externalMouth){
    const v=Geometry.visemes[externalMouth.viseme]||Geometry.visemes.REST,voiced=externalMouth.energy>.012&&!['REST','MBP'].includes(externalMouth.viseme);
    Object.assign(goal,v);goal.mouthOpen=voiced?clamp(externalMouth.open):0;
    goal.mouthSmile=voiced?v.mouthSmile:face.smile*intensity*.3;
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
   attr('h-shadow','transform',`translate(304 579) scale(${fmt(1+q.jump*.007)} 1) translate(-304 -579)`);
   for(const id of ['h-head','h-hair-back'])attr(id,'transform',`rotate(${fmt(head)} 301 226) translate(0 ${fmt(-Math.sin(time*3.5)*q.voice*.7)})`);
   let blink=0;const bt=time-blinkStart;if(bt>=0&&bt<.2)blink=Math.sin(bt/.2*Math.PI);
   const openness=clamp(q.eye*(1-blink),.005,1.25),closed=clamp((.13-openness)/.1);
   for(const side of ['l','r']){
    const sign=side==='l'?1:-1,top=25*openness,bottom=18*openness;
    const upper=`M-18 0 C-18 ${fmt(-top)} 18 ${fmt(-top)} 18 0`,d=upper+` C18 ${fmt(bottom)}-18 ${fmt(bottom)}-18 0Z`;
    for(const id of ['h-eye-white-','h-eye-cut-'])attr(id+side,'d',d);
    attr('h-lid-'+side,'d',upper);attr('h-eye-white-'+side,'opacity',1-closed);attr('h-lid-'+side,'opacity',1-closed);attr('h-pupil-'+side,'opacity',1-closed);attr('h-eye-closed-'+side,'opacity',closed);
    attr('h-eye-closed-'+side,'d',`M-17 0 Q0 ${fmt(-8*q.smile)} 17 0`);
    attr('h-brow-'+side,'transform',`translate(0 ${fmt(q.brow)}) rotate(${fmt(sign*q.tilt)} ${side==='l'?272:329} 107)`);
    if(p.female){attr('h-lashes-'+side,'opacity',(1-closed)*clamp(openness/.7));attr('h-lashes-'+side,'transform',`translate(0 ${fmt((1-Math.min(1,openness))*13)})`);}
    const gaze=emotion==='thinking'?2*intensity:0;attr('h-pupil-'+side,'transform',`translate(${fmt(gaze)} ${fmt(-gaze*.5)})`);
   }
   attr('h-tears','opacity',emotion==='crying'?intensity:0);
   const mouth=Geometry.mouth(q,'human');for(const [id,attrs]of Object.entries(mouth.attributes)){if(id==='mouth'||id==='muzzle-smile')continue;for(const [k,v]of Object.entries(attrs))attr(id,k,v);}
   attr('mouth','transform',`translate(${fmt(302+q.mouthOffset*.65)} 195) scale(.8)`);
   for(const side of ['l','r']){
    let x=q[side+'x'],y=q[side+'y'];
    if(active==='wave'&&side==='r'){const arrival=clamp(1-Math.hypot(x-408,y-227)/28);x+=Math.sin(time*7)*4*arrival*motion;}
    if(active==='none'){x+=Math.sin(time*2.5+(side==='l'?0:2))*q.voice*3;y-=q.voice*(1+Math.sin(time*3))*3;}
    if(active==='think'&&side==='r'){
     const a=head*Math.PI/180,weight=clamp(1-Math.hypot(x-342,y-250)/35),dx=x-301,dy=y-226;
     x+=(301+dx*Math.cos(a)-dy*Math.sin(a)-x)*weight;y+=(226+dx*Math.sin(a)+dy*Math.cos(a)-y)*weight;
    }
    const arm=sleeve(side,x,y);attr('h-sleeve-'+side,'d',arm.d);attr('h-cuff-'+side,'d',arm.cuff);attr('h-sleeve-light-'+side,'d',arm.highlight);attr('h-hand-'+side,'transform',arm.hand);
   }
  }
  function frame(ms){if(disposed)return;const dt=last?clamp((ms-last)/1000,0,.05):1/60;last=ms;if(!document.hidden){time+=dt;if(!reduced&&time>nextBlink){blinkStart=time;nextBlink=time+3.4+Math.random()*2;}
   const {goal,active}=targets();for(const k of Object.keys(goal))smooth(k,goal[k],dt,k==='mouthOpen'&&externalMouth&&['REST','MBP'].includes(externalMouth.viseme)?80:k.startsWith('mouth')?32:['lx','ly','rx','ry'].includes(k)?8:11);draw(active);}
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
 host.HumanMotion={createRig,sleeve};
})(typeof window!=='undefined'?window:this);
