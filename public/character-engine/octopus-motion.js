/* Octo has its own soft-body performance rig. Live audio/tools still use the
   common CharacterPort contract; only mouth geometry is shared with other rigs. */
(function(host){
 'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),f=n=>+n.toFixed(3),lerp=(a,b,t)=>a+(b-a)*t;
 const faces={
  neutral:{openL:1,openR:1,gazeX:0,gazeY:0,browL:0,browR:0,brows:0,smile:.6,lean:0},
  happy:{openL:.95,openR:1,gazeX:0,gazeY:0,browL:-5,browR:5,brows:0,smile:.85,lean:-1},
  sad:{openL:.65,openR:.72,gazeX:0,gazeY:5,browL:-22,browR:22,brows:.8,smile:-.7,lean:4},
  crying:{openL:.12,openR:.12,gazeX:0,gazeY:4,browL:-22,browR:22,brows:.8,smile:-.8,lean:4},
  surprised:{openL:1.2,openR:1.15,gazeX:0,gazeY:0,browL:0,browR:0,brows:0,smile:0,lean:-4},
  thinking:{openL:.75,openR:1.06,gazeX:7,gazeY:-7,browL:8,browR:-8,brows:.5,smile:.12,lean:5},
  angry:{openL:.66,openR:.7,gazeX:0,gazeY:1,browL:24,browR:-24,brows:1,smile:-.65,lean:-4},
  sleepy:{openL:.18,openR:.18,gazeX:0,gazeY:4,browL:0,browR:0,brows:0,smile:.1,lean:8},
  laughing:{openL:.015,openR:.015,gazeX:0,gazeY:0,browL:0,browR:0,brows:0,smile:1,lean:-5},
  excited:{openL:1.1,openR:1.08,gazeX:0,gazeY:-2,browL:0,browR:0,brows:0,smile:.95,lean:-2}
 };
 function createRig(root,options={}){
  const A=host.OctopusAnatomy,G=host.CharacterGeometry,nodes=new Map();
  const $=id=>{if(!nodes.has(id))nodes.set(id,root.querySelector('#'+id));return nodes.get(id);};
  const attr=(id,key,value)=>$(id)?.setAttribute(key,String(value));
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
  let time=0,last=null,raf=0,disposed=false,emotion='neutral',intensity=.7,energy=0,externalMouth=null,gesture='none',until=0,blinkStart=-99,nextBlink=3.2,jumpStart=-99;
  const q={...A.rest,...faces.neutral,...G.mouthBase,mouthSmile:.6,voice:0,wave:0,cheer:0,tears:0};
  const velocity=Object.fromEntries(Object.keys(q).map(k=>[k,0]));
  // Preserve both pose and velocity when tools interrupt one another. Fixed small
  // integration steps keep the same trajectory on 30/60/120 Hz displays.
  function smooth(k,target,dt,omega){
   const x=q[k]-target,v=velocity[k],decay=Math.exp(-omega*dt);
   q[k]=target+(x+(v+omega*x)*dt)*decay;velocity[k]=(v-omega*(v+omega*x)*dt)*decay;
  }
  function targets(){
   const face=faces[emotion],goal={};
   for(const k of Object.keys(faces.neutral))goal[k]=lerp(faces.neutral[k],face[k],intensity);
   if(emotion==='laughing'&&intensity>.5)goal.openL=goal.openR=.015;
   const faceLean=goal.lean,active=time<until?gesture:'none';
   Object.assign(goal,A.rest,A.poses[active]||{},{wave:active==='wave'&&!reduced?1:0,cheer:active==='celebrate'&&!reduced?1:0,voice:0,tears:emotion==='crying'?intensity:0});
   goal.lean+=faceLean*.22;
   // Tip oscillation and curl have different phases; the mantle leads and the
   // tentacle follows. No whole-character rocking or eight synchronized arms.
   goal.rx+=q.wave*Math.sin(time*4.8)*8;
   goal.curlR+=q.wave*Math.sin(time*4.8-.7)*.12;
   goal.ly+=q.cheer*Math.sin(time*3.6-.5)*3;goal.ry+=q.cheer*Math.sin(time*3.6)*3;
   const mouth=G.expressionMouth[emotion]||G.mouthBase;
   Object.assign(goal,G.mouthBase,mouth,{mouthOpen:(mouth.mouthOpen||0)*intensity,mouthSmile:goal.smile});
   if(externalMouth){
    const viseme=G.visemes[externalMouth.viseme]||G.visemes.REST,closed=['REST','MBP'].includes(externalMouth.viseme),voiced=externalMouth.energy>.012&&!closed;
    Object.assign(goal,viseme);goal.mouthOpen=voiced?clamp(externalMouth.open):0;
    goal.mouthSmile=voiced?viseme.mouthSmile:externalMouth.viseme==='MBP'?0:goal.smile;
    if(externalMouth.width!==undefined)goal.mouthWidth=.62+clamp(externalMouth.width)*.54;
    if(externalMouth.round!==undefined)goal.mouthRound=clamp(externalMouth.round);
    goal.voice=reduced?0:clamp(externalMouth.energy*2)*(options.speechMotionScale??.5);
   }
   const t=time-jumpStart;
   if(!reduced&&t>=0&&t<1.3){
    if(t<.24)goal.squash=1-.095*Math.sin(t/.24*Math.PI/2)**2;
    else if(t<1){const u=(t-.24)/.76,h=Math.sin(Math.PI*u);goal.lift=-58*h;goal.squash=1+.035*h;goal.tuck=h;}
    else goal.squash=1-.07*Math.sin((t-1)/.3*Math.PI);
   }
   return goal;
  }
  function draw(){
   attr('m-character','transform',`translate(0 ${f(q.lift)})`);
   A.draw(attr,q,time,reduced);
   attr('m-shadow','transform',`translate(303 445) scale(${f(clamp(1+q.lift/170,.6,1.05))} 1) translate(-303 -445)`);
   const bt=time-blinkStart,blink=bt>=0&&bt<.19?Math.sin(bt/.19*Math.PI):0;
   for(const side of ['l','r']){
    const rx=A.eyes[side].rx,ry=A.eyes[side].ry,open=clamp(q[side==='l'?'openL':'openR']*(1-blink),.005,1.25),top=-ry*1.333*open,bottom=ry*1.333*open;
    const d=`M${-rx} 0 C${-rx} ${f(top)} ${rx} ${f(top)} ${rx} 0 C${rx} ${f(bottom)} ${-rx} ${f(bottom)} ${-rx} 0Z`,closed=clamp((.15-open)/.1);
    attr('m-white-'+side,'d',d);attr('m-cut-'+side,'d',d);attr('m-white-'+side,'opacity',f(1-closed));attr('m-pupil-'+side,'opacity',f(1-closed));
    attr('m-pupil-'+side,'transform',`translate(${f(q.gazeX)} ${f(q.gazeY)})`);attr('m-closed-'+side,'opacity',f(closed));
    attr('m-closed-'+side,'d',`M${f(-rx*.72)} 0 Q0 ${f(-12*q.smile)} ${f(rx*.72)} 0`);
    attr('m-brow-'+side,'opacity',f(q.brows));attr('m-brow-'+side,'transform',`rotate(${f(q[side==='l'?'browL':'browR'])} 0 -42)`);
   }
   const mouth=G.mouth(q,'mascot');for(const [id,attrs]of Object.entries(mouth.attributes)){if(id==='mouth'||id==='muzzle-smile')continue;for(const [key,v]of Object.entries(attrs))attr(id,key,v);}
   const m=A.mouth;
   attr('mouth','transform',`translate(${f(m.x+q.mouthOffset*.7)} ${m.y}) scale(${m.sx} ${m.sy})`);attr('mouth-edge','stroke-width',3);
   attr('m-tears','opacity',f(q.tears));
  }
  function step(dt){
   time+=dt;
   if(!reduced&&time>nextBlink){blinkStart=time;nextBlink=time+3.5+Math.random()*1.5;}
   const goal=targets();
   for(const [k,v]of Object.entries(goal)){
    const closed=k==='mouthOpen'&&externalMouth&&['REST','MBP'].includes(externalMouth.viseme);
    smooth(k,v,dt,closed?80:k.startsWith('mouth')?32:['lx','ly','rx','ry','curlL','curlR'].includes(k)?9:k==='lift'?24:k==='squash'?18:12);
   }
  }
  function frame(ms){
   if(disposed)return;
   let dt=last===null?1/60:clamp((ms-last)/1000,0,.05);last=ms;
   if(!document.hidden){while(dt>1e-7){const stepSize=Math.min(dt,1/120);step(stepSize);dt-=stepSize;}draw();}
   raf=requestAnimationFrame(frame);
  }
  const visibility=()=>{last=null;},preference=()=>{reduced=media.matches;};
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);draw();raf=requestAnimationFrame(frame);
  return {
   setEmotion:name=>{if(Object.hasOwn(faces,name))emotion=name;},
   setIntensity:n=>{if(Number.isFinite(n))intensity=clamp(n);},setEnergy:n=>{if(Number.isFinite(n))energy=clamp(n);},setMouthPose:value=>{externalMouth=value;},
   setGesture:(name,duration=3)=>{if(!['none','wave','blink','jump','explain','think','celebrate'].includes(name))return;gesture=name;until=time+clamp(Number.isFinite(duration)?duration:3,.1,6);if(name==='blink')blinkStart=time;if(name==='jump')jumpStart=time;else jumpStart=-99;},
   cancelActions:()=>{gesture='none';until=0;jumpStart=-99;},setFlight:()=>false,stopFlight:()=>{},flightState:()=>null,
   destroy:()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);},
   getState:()=>({rig:'octopus',emotion,intensity,energy,gesture:time<until?gesture:'none',disposed,...q})
  };
 }
 host.OctopusMotion={createRig};
})(typeof window!=='undefined'?window:this);
