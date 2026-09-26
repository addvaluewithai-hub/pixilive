/* Mascot performance: coordinated body poses over the existing arm and speech geometry. */
(function(host){
 'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),f=n=>+n.toFixed(3),lerp=(a,b,t)=>a+(b-a)*t;
 const rest={lx:202,ly:345,rx:411,ry:331,lean:-3,squash:1,lFoot:0,rFoot:0,frontL:0,frontR:0};
 const poses={
  none:{},wave:{rx:425,ry:227,lean:-7,rFoot:-5},think:{rx:355,ry:307,lean:8,frontR:1},
  explain:{rx:432,ry:341,lean:-6,rFoot:-4},celebrate:{lx:176,ly:256,rx:429,ry:249,lean:-4,lFoot:-6,rFoot:8,squash:1.035}
 };
 const faces={
  neutral:{openL:.82,openR:1,gazeX:0,gazeY:0,browL:0,browR:0,brows:0,smile:.65,lean:0},
  happy:{openL:.95,openR:1,gazeX:0,gazeY:0,browL:-5,browR:5,brows:0,smile:.85,lean:-1},
  sad:{openL:.65,openR:.72,gazeX:0,gazeY:5,browL:-22,browR:22,brows:.8,smile:-.7,lean:4},
  crying:{openL:.12,openR:.12,gazeX:0,gazeY:4,browL:-22,browR:22,brows:.8,smile:-.8,lean:4},
  surprised:{openL:1.2,openR:1.15,gazeX:0,gazeY:0,browL:0,browR:0,brows:0,smile:0,lean:-4},
  thinking:{openL:.52,openR:1.1,gazeX:7,gazeY:-7,browL:8,browR:-8,brows:.5,smile:.12,lean:5},
  angry:{openL:.66,openR:.7,gazeX:0,gazeY:1,browL:24,browR:-24,brows:1,smile:-.65,lean:-4},
  sleepy:{openL:.18,openR:.18,gazeX:0,gazeY:4,browL:0,browR:0,brows:0,smile:.1,lean:8},
  laughing:{openL:.015,openR:.015,gazeX:0,gazeY:0,browL:0,browR:0,brows:0,smile:1,lean:-5},
  excited:{openL:1.1,openR:1.08,gazeX:0,gazeY:-2,browL:0,browR:0,brows:0,smile:.95,lean:-2}
 };
 function createRig(root,options={}){
  if(!Object.hasOwn(host.MascotArt.presets,options.preset))throw new Error('Unknown mascot rig');
  const G=host.CharacterGeometry,p=host.MascotArt.presets[options.preset],nodes=new Map();
  const anatomy=p.anatomy==='octopus'?host.OctopusAnatomy:null,base=anatomy?.rest||rest,poseSet=anatomy?.poses||poses;
  const $=id=>{if(!nodes.has(id))nodes.set(id,root.querySelector('#'+id));return nodes.get(id);};
  const attr=(id,key,value)=>$(id)?.setAttribute(key,String(value));
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
  let emotion='neutral',intensity=.7,energy=.12,externalMouth=null,gesture='none',until=0,time=0,last=0,raf=0,disposed=false,blinkStart=-99,nextBlink=2.8,jumpStart=-99;
  const q={...faces.neutral,...base,...G.mouthBase,mouthSmile:.65,lift:0,wave:0,voice:0};
  const velocity=Object.fromEntries(Object.keys(q).map(k=>[k,0]));
  const smooth=(k,target,dt,omega=11)=>{const x=q[k]-target,v=velocity[k],e=Math.exp(-omega*dt);q[k]=target+(x+(v+omega*x)*dt)*e;velocity[k]=(v-omega*(v+omega*x)*dt)*e;};
  function targets(){
   const face=faces[emotion],goal={};for(const k of Object.keys(faces.neutral))goal[k]=lerp(faces.neutral[k],face[k],intensity);
   if(emotion==='laughing'&&intensity>.5){goal.openL=.015;goal.openR=.015;}
   const faceLean=goal.lean,active=time<until?gesture:'none';
   Object.assign(goal,base,poseSet[active]||{}, {lift:0,wave:active==='wave'&&!reduced?1:0,voice:0});goal.lean+=faceLean*.55;
   goal.rx+=Math.sin(time*6)*q.wave*6;
   const mouth=G.expressionMouth[emotion]||G.mouthBase;
   Object.assign(goal,G.mouthBase,mouth,{mouthOpen:(mouth.mouthOpen||0)*intensity,mouthSmile:goal.smile});
   if(externalMouth){
    const viseme=G.visemes[externalMouth.viseme]||G.visemes.REST,closed=['REST','MBP'].includes(externalMouth.viseme),voiced=externalMouth.energy>.012&&!closed;
    Object.assign(goal,viseme);goal.mouthOpen=voiced?clamp(externalMouth.open):0;
    goal.mouthSmile=voiced?viseme.mouthSmile:externalMouth.viseme==='MBP'?0:goal.smile;
    if(externalMouth.width!==undefined)goal.mouthWidth=.62+clamp(externalMouth.width)*.54;
    if(externalMouth.round!==undefined)goal.mouthRound=clamp(externalMouth.round);
    goal.voice=reduced?0:clamp(externalMouth.energy*2)*(options.speechMotionScale??.65);
   }
   const t=time-jumpStart;
   if(!reduced&&t>=0&&t<1.15){
    if(t<.18)goal.squash=1-.11*Math.sin(t/.18*Math.PI/2)**2;
    else if(t<.9){const u=(t-.18)/.72;goal.lift=-70*Math.sin(Math.PI*u);goal.squash=1+.075*Math.sin(Math.PI*u);goal.lFoot=-16*Math.sin(Math.PI*u);goal.rFoot=22*Math.sin(Math.PI*u);}
    else goal.squash=1-.1*Math.sin((t-.9)/.25*Math.PI);
   }
   return goal;
  }
  function draw(){
   const motion=reduced?0:1,breathe=Math.sin(time*1.9)*.004*motion,bob=Math.sin(time*3.8)*q.voice*1.2,sy=q.squash+breathe,sx=1/Math.sqrt(sy),lean=q.lean+Math.sin(time*2.7)*q.voice;
   attr('m-character','transform',`translate(0 ${f(q.lift)})`);
   attr('m-upper','transform',`translate(302 ${f(405+bob)}) rotate(${f(lean)}) scale(${f(sx)} ${f(sy)}) translate(-302 -405)`);
   const shadowY=anatomy?.shadowY||488;
   attr('m-shadow','transform',`translate(303 ${shadowY}) scale(${f(clamp(1+q.lift/180,.55,1.1))} 1) translate(-303 ${-shadowY})`);
   const angle=lean*Math.PI/180,anchor=(x,y)=>{const dx=(x-302)*sx,dy=(y-405)*sy;return [302+dx*Math.cos(angle)-dy*Math.sin(angle),405+bob+dx*Math.sin(angle)+dy*Math.cos(angle)];};
   if(anatomy)anatomy.draw(attr,q,time,reduced);
   else for(const side of ['l','r']){
    const left=side==='l',[x,y]=anchor(left?272:333,399),footY=475+q[side+'Foot'],footX=left?252:348;
    attr('m-leg-'+side,'d',`M${f(x)} ${f(y)} Q${f(lerp(x,footX,.4)+(left?6:-6))} ${f((y+footY)/2)} ${footX} ${f(footY)} Q${footX+(left?-6:6)} ${f(footY+1)} ${footX+(left?-17:15)} ${f(footY)}`);
    const arm=G.arm({side,x:q[side+'x'],y:q[side+'y']+42,body:1.5});attr('arm-'+side,'d',arm.d);attr('hand-'+side,'transform',`translate(${arm.x} ${f(arm.y-42)})`);
    // Only the distal part comes in front for hand-to-cheek poses; its anchor stays inside the body.
    const [a,b,c,d]=arm.centerline,t=.62,point=(p,q)=>p.map((n,i)=>lerp(n,q[i],t));
    const ab=point(a,b),bc=point(b,c),cd=point(c,d),abc=point(ab,bc),bcd=point(bc,cd),start=point(abc,bcd);
    attr('m-fore-'+side,'d',`M${start.map(f).join(' ')} C${bcd.map(f).join(' ')} ${cd.map(f).join(' ')} ${d.map(f).join(' ')}`);
    attr('m-fore-'+side,'transform','translate(0 -42)');attr('m-fore-'+side,'fill','none');attr('m-fore-'+side,'stroke',p.limb);attr('m-fore-'+side,'stroke-width',32);attr('m-fore-'+side,'stroke-linecap','round');attr('m-fore-'+side,'opacity',f(q[side==='l'?'frontL':'frontR']));
   }
   const bt=time-blinkStart,blink=bt>=0&&bt<.19?Math.sin(bt/.19*Math.PI):0;
   for(const side of ['l','r']){
    const rx=anatomy?.eyes[side].rx||(side==='l'?23:31),ry=anatomy?.eyes[side].ry||(side==='l'?27:35),open=clamp(q[side==='l'?'openL':'openR']*(1-blink),.005,1.25),top=-ry*1.333*open,bottom=ry*1.333*open;
    const d=`M${-rx} 0 C${-rx} ${f(top)} ${rx} ${f(top)} ${rx} 0 C${rx} ${f(bottom)} ${-rx} ${f(bottom)} ${-rx} 0Z`,closed=clamp((.15-open)/.1);
    attr('m-white-'+side,'d',d);attr('m-cut-'+side,'d',d);attr('m-white-'+side,'opacity',f(1-closed));attr('m-pupil-'+side,'opacity',f(1-closed));
    attr('m-pupil-'+side,'transform',`translate(${f(q.gazeX)} ${f(q.gazeY)})`);attr('m-closed-'+side,'opacity',f(closed));
    attr('m-closed-'+side,'d',`M${f(-rx*.72)} 0 Q0 ${f(-12*q.smile)} ${f(rx*.72)} 0`);
    attr('m-brow-'+side,'opacity',f(q.brows));attr('m-brow-'+side,'transform',`rotate(${f(q[side==='l'?'browL':'browR'])} 0 -42)`);
   }
   attr('m-tears','opacity',emotion==='crying'?intensity:0);
   const mouth=G.mouth(q,'mascot');for(const [id,attrs]of Object.entries(mouth.attributes)){if(id==='mouth'||id==='muzzle-smile')continue;for(const [key,v]of Object.entries(attrs))attr(id,key,v);}
   const m=anatomy?.mouth||{x:303,y:324,sx:.95,sy:1.15};
   attr('mouth','transform',`translate(${f(m.x+q.mouthOffset*.7)} ${m.y}) scale(${m.sx} ${m.sy})`);attr('mouth-edge','stroke-width',anatomy?3:4);
  }
  function frame(ms){if(disposed)return;const dt=last?clamp((ms-last)/1000,0,.05):1/60;last=ms;
   if(!document.hidden){time+=dt;if(!reduced&&time>nextBlink){blinkStart=time;nextBlink=time+3.3+Math.random()*1.6;}
    const goal=targets();for(const [k,target]of Object.entries(goal))smooth(k,target,dt,k==='mouthOpen'&&externalMouth&&['REST','MBP'].includes(externalMouth.viseme)?80:k.startsWith('mouth')?32:['lx','ly','rx','ry','lean'].includes(k)?8:k==='lift'||k==='squash'?20:11);draw();}
   raf=requestAnimationFrame(frame);
  }
  const visibility=()=>{last=0;},preference=()=>{reduced=media.matches;};document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);draw();raf=requestAnimationFrame(frame);
  return {
   setEmotion:name=>{if(Object.hasOwn(faces,name))emotion=name;},setIntensity:n=>{if(Number.isFinite(n))intensity=clamp(n);},setEnergy:n=>{if(Number.isFinite(n))energy=clamp(n);},setMouthPose:value=>{externalMouth=value;},
   setGesture:(name,duration=3)=>{if(!['none','wave','blink','jump','explain','think','celebrate'].includes(name))return;gesture=name;until=time+clamp(Number.isFinite(duration)?duration:3,.1,6);if(name==='blink')blinkStart=time;if(name==='jump')jumpStart=time;else jumpStart=-99;},
   cancelActions:()=>{gesture='none';until=0;jumpStart=-99;},setFlight:()=>false,stopFlight:()=>{},flightState:()=>null,
   destroy:()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);},
   getState:()=>({emotion,intensity,energy,gesture:time<until?gesture:'none',disposed,...q})
  };
 }
 host.MascotMotion={createRig};
})(typeof window!=='undefined'?window:this);
