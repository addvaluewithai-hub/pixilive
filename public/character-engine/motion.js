/* Ember: one persistent SVG, parameterized face and continuous silhouette arm rig.
   No bitmap frames, character replacement, external libraries or network calls. */
(function(host){
 'use strict';
 function createRig(root, options={}) {
 const Geometry=host.CharacterGeometry;
 const flight=options.appearance?.().species==='sprite'?host.CharacterFlight.createFlight():null;
 let wingPhase=0;
 const appearance=()=>options.appearance?options.appearance():({head:1,body:1,eyes:1,species:'fox'});
 const uiSet=(id,key,value)=>{const el=$(id);if(el)el[key]=value;};
 const nodes=new Map();
 const $ = id => {if(!nodes.has(id))nodes.set(id,root.querySelector('#'+id));return nodes.get(id);};
 const all = s => Array.from(root.querySelectorAll(s));
 const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
 const lerp = (a, b, t) => a + (b-a)*t;
 const fmt = n => Number(n.toFixed(3));
 const attr = (id, name, value) => $(id).setAttribute(name, value);
 const transform = (id, value) => attr(id, 'transform', value);
 const opacity = (id, n) => attr(id, 'opacity', fmt(clamp(n, 0, 1)));
 const media = window.matchMedia('(prefers-reduced-motion: reduce)');
 let reduced = media.matches;
 const base = {openL:1,openR:1,tilt:0,bottom:.95,browLY:0,browRY:0,browLR:0,browRR:0,
  headR:0,headY:0,earL:0,earR:0,handLX:219,handLY:414,handRX:384,handRY:414,
  tears:0,blush:1,gazeX:0,gazeY:0,pupil:1,closedSmile:1,sob:0,laugh:0};
 const emotions = {
  happy: {...base},
  sad: {...base,openL:.74,openR:.74,browLY:3,browRY:3,browLR:-23,browRR:23,
   headR:-4,headY:5,earL:-12,earR:12,gazeY:4,handLX:235,handLY:428,handRX:371,handRY:428,blush:.3},
  crying: {...base,openL:.46,openR:.46,bottom:.65,browLR:-28,browRR:28,browLY:6,browRY:6,
   headY:4,earL:-16,earR:16,handLX:214,handLY:298,handRX:391,handRY:298,tears:1,blush:.35,sob:1},
  surprised: {...base,openL:1.21,openR:1.21,bottom:1.07,browLY:-15,browRY:-15,
   headY:-4,earL:4,earR:-4,handLX:203,handLY:312,handRX:403,handRY:312,pupil:.88,blush:.45},
  thinking: {...base,openL:.63,openR:1.05,browLY:9,browRY:-11,browLR:10,browRR:7,
   headR:-6,earL:-8,earR:4,handLX:246,handLY:410,handRX:335,handRY:322,gazeX:9,gazeY:-7,blush:.45},
  angry: {...base,openL:.52,openR:.52,tilt:13,bottom:.85,browLY:12,browRY:12,browLR:22,browRR:-22,
   headY:4,earL:-12,earR:12,handLX:327,handLY:390,handRX:284,handRY:407,blush:.7,pupil:.93},
  sleepy: {...base,openL:.19,openR:.19,bottom:.52,browLY:6,browRY:6,browLR:-5,browRR:5,
   headR:7,headY:7,earL:-9,earR:12,gazeY:6,handLX:234,handLY:431,handRX:373,handRY:428,blush:.45,closedSmile:-.4},
  laughing: {...base,openL:.025,openR:.025,bottom:.25,browLY:5,browRY:5,
   headR:-3,headY:-3,handLX:268,handLY:400,handRX:340,handRY:399,blush:1.25,laugh:1},
  excited: {...base,openL:.91,openR:.91,browLY:-7,browRY:-7,
   headY:-5,earL:5,earR:-5,handLX:165,handLY:294,handRX:442,handRY:292,blush:1.2}
 };
 // All expressions share the same mouth parameters and path topology.
 Object.assign(base,Geometry.expressionMouth.happy);
 for(const [name,pose] of Object.entries(emotions))Object.assign(pose,Geometry.expressionMouth[name]);
 Object.assign(emotions.excited,{handLX:196,handLY:317,handRX:409,handRY:315});
 const labels = {happy:'مبسوط',sad:'زعلان',crying:'بيعيّط',surprised:'متفاجئ',thinking:'بيفكّر',angry:'متعصّب',sleepy:'نعسان',laughing:'بيضحك',excited:'متحمّس'};
 const settings = {emotion:'happy',intensity:1,energy:.5,walkSpeed:0,wave:0,gazeX:0,gazeY:0,mouse:true,playbackRate:1};
 const rig = {...base,walk:0,energy:.5,wave:0,lookX:0,lookY:0,tail:0,speechActivity:0,speechHands:0};
 const velocity = Object.fromEntries(Object.keys(rig).map(k=>[k,0]));
 if(options.externalControl)settings.mouse=false;
 let paused=false, time=0, previous=0, raf=0, disposed=false, phase=0;
 let blinkStart=-99, nextBlink=2.5, waveUntil=0, jumpStart=-99;
 let travel=0, moveDirection=0, lookX=0, lookY=0;
 let heldLeft=false, heldRight=false;
 const tracks={l:{x:base.handLX,y:base.handLY,vx:0,vy:0},r:{x:base.handRX,y:base.handRY,vx:0,vy:0}};
 let speech=null,speechQueue=null,speechStart=0,speechIndex=-1;
 let externalMouth=null,gesturePose=null,gestureUntil=0;
 const armKeys=['handLX','handLY','handRX','handRY'];
 function cancelActions(){waveUntil=0;jumpStart=-99;gesturePose=null;gestureUntil=0;settings.wave=0;}
 function setGesture(name,duration){
  const hold=Number.isFinite(duration)?clamp(duration,.1,6):null;
  cancelActions();
  if(name==='wave'){doWave();if(hold!==null)waveUntil=time+hold;}else if(name==='blink')doBlink();else if(name==='jump')doJump();
  else if(name==='think'){gesturePose={handRX:335,handRY:322};gestureUntil=time+(hold??2);}
  else if(name==='explain'){gesturePose={handRX:398,handRY:355};gestureUntil=time+(hold??1.6);}
  else if(name==='celebrate'){gesturePose={handLX:196,handLY:317,handRX:409,handRY:315};gestureUntil=time+(hold??2);}
 }
 function applyGeometry(result){for(const [id,attrs] of Object.entries(result.attributes))for(const [key,value] of Object.entries(attrs))attr(id,key,value);}
 function setViseme(name,weight=1){
  if(!Object.hasOwn(Geometry.visemes,name))throw new Error('Unknown viseme: '+name);
  if(!Number.isFinite(weight))throw new Error('Viseme weight must be finite.');
  speechQueue=null;speech={name,weight:clamp(weight,0,1)};syncSpeech();if(paused||reduced)settle();
 }
 function stopSpeech(){speech=null;speechQueue=null;syncSpeech();if(paused||reduced)settle();}
 function syncSpeech(){all('[data-viseme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.viseme===speech?.name)));uiSet('speech-status','textContent',speech?'حالة الفم: '+speech.name:'الفم تابع للتعبير');}
 function playVisemes(events){
  if(!Array.isArray(events)||!events.length||events.some((e,i)=>!Object.hasOwn(Geometry.visemes,e.name)||!Number.isFinite(e.at)||e.at<0||!Number.isFinite(e.duration)||e.duration<=0||(i>0&&e.at<events[i-1].at+events[i-1].duration-1e-8)))throw new Error('Expected non-overlapping viseme events with at/duration in seconds.');
  speechQueue=events.map(e=>({name:e.name,at:e.at,duration:e.duration}));speechStart=time;speechIndex=-1;speech=null;setPause(false);
 }
 function updateSpeech(){
  if(!speechQueue)return;const t=time-speechStart,last=speechQueue.at(-1);
  if(t>=last.at+last.duration){stopSpeech();return;}
  const index=speechQueue.findIndex(e=>t>=e.at&&t<e.at+e.duration);
  if(index!==speechIndex){speechIndex=index;speech=index<0?{name:'REST',weight:1}:{name:speechQueue[index].name,weight:1};syncSpeech();}
 }
 // Endpoint velocities remain continuous even when a gesture is interrupted.
 function moveArm(side,x,y,dt,snap=false){
  const q=tracks[side];
  if(snap){Object.assign(q,{x,y,vx:0,vy:0,sx:x,sy:y,svx:0,svy:0,bulge:0,gx:x,gy:y,t:1,duration:1});return;}
  if(q.gx!==x||q.gy!==y){
   Object.assign(q,{sx:q.x,sy:q.y,svx:q.vx,svy:q.vy,gx:x,gy:y,t:0,duration:clamp(.5+Math.hypot(x-q.x,y-q.y)/500,.55,.88),bulge:(side==='l'?-1:1)*Math.min(25,Math.abs(y-q.y)*.24)});
  }
  q.t=Math.min(q.duration,q.t+dt);const t=q.t/q.duration,t2=t*t,t3=t2*t,t4=t3*t,t5=t4*t;
  const h=10*t3-15*t4+6*t5,v=t-6*t3+8*t4-3*t5,b=16*t2*(1-t)*(1-t);
  const dh=30*t2-60*t3+30*t4,dv=1-18*t2+32*t3-15*t4,db=32*t-96*t2+64*t3;
  q.x=q.sx+(x-q.sx)*h+q.svx*q.duration*v+q.bulge*b;
  q.y=q.sy+(y-q.sy)*h+q.svy*q.duration*v;
  q.vx=(x-q.sx)*dh/q.duration+q.svx*dv+q.bulge*db/q.duration;
  q.vy=(y-q.sy)*dh/q.duration+q.svy*dv;
 }
 function updateArms(goal,dt,snap=false){
  moveArm('l',goal.handLX,goal.handLY,dt,snap);
  moveArm('r',lerp(goal.handRX,425,goal.wave),lerp(goal.handRY,312,goal.wave),dt,snap);
 }
 const listenerController = new AbortController();
 const on = (el, event, fn) => {if(el)el.addEventListener(event, fn, {signal:listenerController.signal});};

 // Exact critically damped update, stable across refresh rates and long frames.
 function smooth(key, target, dt, omega=12) {
  const x=rig[key]-target, v=velocity[key], exp=Math.exp(-omega*dt);
  rig[key]=target+(x+(v+omega*x)*dt)*exp;
  velocity[key]=(v-omega*(v+omega*x)*dt)*exp;
 }
 function setEmotion(name) {
  if (!Object.hasOwn(emotions,name)) return;
  settings.emotion=name;
  all('[data-emotion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emotion===name)));
  uiSet('current-emotion','textContent',labels[name]);
  if(paused || reduced) settle();
 }
 function syncPace(){
  all('[data-pace]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pace)===settings.walkSpeed)));
  uiSet('walk-speed','value',Math.round(settings.walkSpeed*100));
  uiSet('walk-speed-value','textContent',Math.round(settings.walkSpeed*100)+'%');
 }
 function setPace(n){if(typeof n!=='number'||!Number.isFinite(n))throw new Error('Pace must be a finite number.');settings.walkSpeed=clamp(n,0,1);syncPace();if(paused||reduced)settle();}
 function setPause(value){
  paused=value;$('pause')?.setAttribute('aria-pressed',String(paused));
  uiSet('pause','textContent',paused?'كمّل الحركة':'تجميد الحركة');
  previous=0;
 }
 function announce(text){uiSet('action-status','textContent',text);}
 function doBlink(){
  if(paused)setPause(false);
  blinkStart=time;announce('إمبر بيرمش');
 }
 function doWave(){
  if(paused)setPause(false);
  waveUntil=time+(reduced?.9:2.7);announce('إمبر بيسلّم عليك');
 }
 function doJump(){
  if(paused)setPause(false);
  if(time-jumpStart>1.05)jumpStart=time;
  announce('إمبر بينط');
 }
 function reset(){
  Object.assign(settings,{emotion:'happy',intensity:1,energy:.5,walkSpeed:0,wave:0,gazeX:0,gazeY:0,mouse:true});
  lookX=0;lookY=0;heldLeft=false;heldRight=false;moveDirection=0;travel=0;
  stopSpeech();waveUntil=0;jumpStart=-99;blinkStart=-99;nextBlink=time+3;
  for(const [id,n] of [['intensity',100],['energy',50],['walk-speed',0],['wave',0],['gaze-x',0],['gaze-y',0]]){
   uiSet(id,'value',n);uiSet(id+'-value','textContent',n+(id.startsWith('gaze')?'':'%'));
  }
  settings.playbackRate=1;uiSet('slow-motion','checked',false);uiSet('mouse-gaze','checked',true);setPause(false);setPace(0);setEmotion('happy');
 }
 function targets(){
  const result={};
  for(const k of Object.keys(base))result[k]=lerp(base[k],emotions[settings.emotion][k],settings.intensity);
  if(options.externalControl){
   for(const k of armKeys)result[k]=base[k];
   if(gesturePose&&time<gestureUntil)Object.assign(result,gesturePose);
   if(externalMouth){
    const p=Geometry.visemes[externalMouth.viseme]||Geometry.visemes.REST;
    for(const k of Object.keys(Geometry.mouthBase))result[k]=p[k];
    const voiced=externalMouth.viseme!=='REST'&&externalMouth.energy>.012;
    result.mouthOpen=voiced?clamp(externalMouth.open,0,1):0;
    if(externalMouth.viseme==='MBP')result.mouthOpen=0;
    if(externalMouth.round!==undefined)result.mouthRound=externalMouth.round;
    if(externalMouth.width!==undefined)result.mouthWidth=.62+externalMouth.width*.54;
    result.mouthSmile=voiced?(p.mouthSmile||0):result.mouthSmile*.35;
   }
  }
  result.walk=reduced?0:Math.max(settings.walkSpeed,moveDirection?.55:0);
  result.energy=settings.energy;
  // Audio-clock mouth samples drive small physical accents, never inferred emotions.
  const speechLevel=options.externalControl&&externalMouth&&externalMouth.viseme!=='REST'?clamp((externalMouth.energy-.018)*3.2,0,1):0;
  const restraint=['sad','crying','sleepy','angry'].includes(settings.emotion)?.25:settings.emotion==='thinking'?.45:1;
  const scale=options.speechMotionScale===undefined?1:clamp(options.speechMotionScale,0,1);
  result.speechActivity=reduced?0:speechLevel*restraint*scale;
  const explicitGesture=(gesturePose&&time<gestureUntil)||time<waveUntil||time-jumpStart<1.1;
  result.speechHands=explicitGesture?0:result.speechActivity;
  result.wave=Math.max(settings.wave,time<waveUntil?1:0);
  result.lookX=(settings.mouse?lookX:settings.gazeX)*10+result.gazeX;
  result.lookY=(settings.mouse?lookY:settings.gazeY)*7+result.gazeY;
  if(speech)for(const key of Object.keys(Geometry.mouthBase))result[key]=lerp(result[key],Geometry.visemes[speech.name][key],speech.weight);
  return result;
 }
 function settle(){const goal=targets();for(const k in goal){rig[k]=goal[k];velocity[k]=0;}updateArms(goal,0,true);draw();}
 function eye(side, open, blink){
  const close=1-blink;
  const w=appearance().species==='sprite'?30:25.5, top=43*clamp(open*close*(appearance().species==='cat'?.9:1),.007,1.3), bottom=35*rig.bottom*close;
  const tilt=rig.tilt*(side==='l'?1:-1)*close;
  const left=-tilt*.65, right=tilt*.65;
  const upper=`M${-w} ${fmt(left)} C${-w} ${fmt(-top-tilt)} ${w} ${fmt(-top+tilt)} ${w} ${fmt(right)}`;
  const path=upper+` C${w} ${fmt(bottom)} ${-w} ${fmt(bottom)} ${-w} ${fmt(left)}Z`;
  attr('eye-cut-'+side,'d',path);attr('eye-rim-'+side,'d',path);attr('lid-'+side,'d',upper);
  const closedAmount=clamp((.12-open*close)/.1,0,1);
  opacity('eye-rim-'+side,1-closedAmount);opacity('lid-'+side,1-closedAmount);
  opacity('eye-content-'+side,1-closedAmount);
  opacity('pupil-'+side,1-closedAmount);
  opacity('closed-'+side,closedAmount);
  attr('closed-'+side,'d',`M-25 0 Q0 ${fmt(-14*rig.closedSmile)} 25 0`);
  transform('pupil-'+side,`translate(${fmt(clamp(rig.lookX,-11,11))} ${fmt(clamp(rig.lookY,-9,9))}) scale(${fmt(rig.pupil)})`);
 }
 function draw(){
  const shape=appearance();
  if(flight){
   const f=flight.state(),hover=reduced?0:Math.sin(time*2.2)*3*f.lift;
   transform('flight',`translate(${fmt(190+260*f.x)} ${fmt(150+200*f.y+hover)}) rotate(${fmt(f.bank)}) scale(.76) translate(-302 -310)`);
   const spread=reduced?.92:.68+f.lift*(.16+.16*Math.cos(wingPhase));
   for(const side of ['l','r']){const x=side==='l'?269:335;transform('wing-'+side,`translate(${x} 373) scale(${fmt(spread)} 1) rotate(${fmt((side==='l'?1:-1)*(4+Math.sin(wingPhase)*6)*f.lift*(reduced?0:1))}) translate(${-x} -373)`);}
   const shadowScale=.48+f.y*.22;
   transform('flight-shadow',`translate(${fmt(190+260*f.x)} 498) scale(${fmt(shadowScale)} ${fmt(shadowScale)}) translate(-311 -498)`);
   opacity('flight-shadow',.25+f.y*.55);
  }
  const motion=reduced?0:1, energy=.35+rig.energy*.85;
  const idle=Math.sin(time*2.1)*energy*motion;
  const gait=Math.sin(phase), stride=rig.walk;
  const sob=Math.sin(time*15)*rig.sob*.65*motion;
  const laugh=Math.sin(time*12)*rig.laugh*1.3*motion;
  let jump=0, squash=1;
  const jt=time-jumpStart;
  if(!reduced && jt>=0 && jt<1.03){
   if(jt<.16)squash=1-.065*Math.sin(jt/.16*Math.PI*.5);
   else if(jt<.76){const p=(jt-.16)/.6;jump=-67*Math.sin(Math.PI*p);squash=1+.035*Math.sin(Math.PI*p);}
   else squash=1-.055*Math.sin((jt-.76)/.27*Math.PI);
  }
  const walkBob=-Math.abs(Math.sin(phase))*3.5*stride;
  const bob=idle*1.6+walkBob+sob+laugh;
  transform('travel',`translate(${fmt(travel)} 0)`);
  transform('character',`translate(302 ${fmt(488+jump+bob)}) scale(${fmt(1+(1-squash)*.6)} ${fmt(squash)}) translate(-302 -488)`);
  transform('shadow',`translate(${fmt(travel)} 0) translate(311 498) scale(${fmt(1+jump*.005)} ${fmt(1+jump*.003)}) translate(-311 -498)`);
  const speechAccent=motion*rig.speechActivity;
  const headR=rig.headR+idle*.6+rig.lookX*.055+Math.sin(time*2.8)*speechAccent*2.4;
  const headY=rig.headY-idle*.6+sob*.3-Math.max(0,Math.sin(time*4.1))*speechAccent*2.3;
  transform('head',`translate(0 ${fmt(headY)}) rotate(${fmt(headR)} 302 327)`);
  transform('ear-l',`rotate(${fmt(rig.earL+idle*1.1-gait*stride)} 226 181)`);
  transform('ear-r',`rotate(${fmt(rig.earR-idle*.8+gait*stride)} 380 181)`);
  transform('tail',`rotate(${fmt(rig.tail)} 363 428)`);
  transform('scarf-tails',`rotate(${fmt(-rig.tail*.27)} 356 346)`);
  for(const [side,offset,x] of [['l',0,273],['r',Math.PI,332]]){
   const p=phase+offset, swing=Math.sin(p), lift=Math.max(0,Math.cos(p));
   transform('leg-'+side,`translate(${fmt(swing*7*stride)} ${fmt(-lift*13*stride-bob)}) rotate(${fmt(-swing*11*stride)} ${x} 439)`);
   transform('foot-'+side,`rotate(${fmt(swing*8*stride)} ${x} 480)`);
  }
  let blink=0, bt=time-blinkStart;
  if(bt>=0 && bt<.2)blink=Math.pow(Math.sin(bt/.2*Math.PI),.75);
  eye('l',rig.openL,blink);eye('r',rig.openR,blink);
  transform('brow-l',`translate(0 ${fmt(rig.browLY-speechAccent*1.8)}) rotate(${fmt(rig.browLR)} 242 181)`);
  transform('brow-r',`translate(0 ${fmt(rig.browRY-speechAccent*1.5)}) rotate(${fmt(rig.browRR)} 360 181)`);
  applyGeometry(Geometry.mouth(rig,shape.species));
  opacity('blush-l',rig.blush);opacity('blush-r',rig.blush);
  opacity('tears',rig.tears);
  transform('tear-l',`translate(0 ${fmt(motion*(Math.sin(time*4)+1)*3)})`);
  transform('tear-r',`translate(0 ${fmt(motion*(Math.sin(time*4+1.6)+1)*3)})`);
  // Raised paws follow the moving head instead of sliding across the cheeks.
  const followHead=(x,y)=>{
   const weight=clamp((352-y)/44,0,1), a=headR*Math.PI/180;
   const hx=(x-302)*shape.head,hy=(y-327)*shape.head;
   return [lerp(302+(x-302)*shape.body,302+hx*Math.cos(a)-hy*Math.sin(a),weight),lerp(y,327+hx*Math.sin(a)+hy*Math.cos(a)+headY,weight)];
  };
  // Add tiny smooth offsets after arm trajectory evaluation; continuously retargeting
  // the quintic arm trajectory would restart its easing every frame.
  const speechHands=motion*rig.speechHands;
  const leftAccent=.5+.5*Math.sin(time*2.4),rightAccent=.5+.5*Math.sin(time*2.4+1.8);
  let [lx,ly]=followHead(tracks.l.x-speechHands*5*leftAccent,tracks.l.y-speechHands*(5+10*leftAccent));
  let [rx,ry]=followHead(tracks.r.x+speechHands*5*rightAccent,tracks.r.y-speechHands*(5+10*rightAccent));
  const walkInfluence=stride*(1-.8*settings.intensity*(settings.emotion==='happy'?0:1));
  lx+=gait*6*walkInfluence;ly+=gait*14*walkInfluence;
  rx-=gait*6*walkInfluence;ry-=gait*14*walkInfluence;
  const arrival=clamp(1-Math.hypot(rx-425,ry-312)/40,0,1);
  const waveMotion=Math.sin(time*8)*motion*rig.wave*arrival*arrival;
  rx+=waveMotion*3;ry+=waveMotion*1.5;
  applyGeometry(Geometry.arm({side:'l',x:lx,y:ly,body:shape.body}));
  applyGeometry(Geometry.arm({side:'r',x:rx,y:ry,body:shape.body,wave:waveMotion*6}));
 }
 function frame(now){
  if(disposed)return;
  const dt=(previous?Math.min((now-previous)/1000,.05):1/60)*settings.playbackRate;previous=now;
  if(!paused && !document.hidden){
   time+=dt;if(flight){const f=flight.step(dt,reduced);wingPhase=(wingPhase+dt*(5+Math.hypot(f.vx,f.vy)*10))%(Math.PI*2);}
   if(!reduced && time>nextBlink){blinkStart=time;nextBlink=time+3.2+Math.random()*2.6;}
   updateSpeech();const goal=targets();updateArms(goal,dt,reduced);
   for(const key in goal)smooth(key,goal[key],dt,key==='mouthOpen'&&externalMouth&&['REST','MBP'].includes(externalMouth.viseme)?80:key.startsWith('mouth')?32:key==='lookX'||key==='lookY'?15:key==='wave'?10:11);
   const tailGoal=reduced?0:Math.sin(time*2.5-.5)*(2.3+rig.energy*3)+Math.sin(phase-.7)*rig.walk*4;
   smooth('tail',tailGoal,dt,7);
   if(!reduced){phase+=dt*(4+rig.walk*6)*rig.walk;travel=clamp(travel+moveDirection*dt*65,-93,61);}
   draw();
  }
  raf=requestAnimationFrame(frame);
 }
 all('[data-viseme]').forEach(b=>on(b,'click',()=>setViseme(b.dataset.viseme)));
 on($('speech-stop'),'click',stopSpeech);
 on($('speech-demo'),'click',()=>playVisemes(['REST','MBP','AA','L','EE','REST','S','AA','L','AA','MBP','REST','OH','OO','FV','EE','REST'].map((name,i)=>({name,at:i*.3,duration:.3}))));
 on($('slow-motion'),'change',e=>{settings.playbackRate=e.target.checked?.3:1;});
 all('[data-emotion]').forEach(b=>on(b,'click',()=>setEmotion(b.dataset.emotion)));
 all('[data-pace]').forEach(b=>on(b,'click',()=>setPace(Number(b.dataset.pace))));
 on($('wave-action'),'click',doWave);on($('jump-action'),'click',doJump);on($('blink-action'),'click',doBlink);
 on($('character'),'click',doBlink);on($('pause'),'click',()=>setPause(!paused));on($('reset'),'click',reset);
 const inputMap={'intensity':'intensity','energy':'energy','walk-speed':'walkSpeed','wave':'wave','gaze-x':'gazeX','gaze-y':'gazeY'};
 for(const [id,key] of Object.entries(inputMap)){
  on($(id),'input',e=>{
   settings[key]=Number(e.target.value)/100;
   $(id+'-value').textContent=e.target.value+(id.startsWith('gaze')?'':'%');
   if(id.startsWith('gaze')){settings.mouse=false;uiSet('mouse-gaze','checked',false);}
   if(id==='walk-speed')syncPace();
   if(paused||reduced)settle();
  });
 }
 on($('mouse-gaze'),'change',e=>{settings.mouse=e.target.checked;if(paused||reduced)settle();});
 on($('play-area')||root,'pointermove',e=>{
  if(!settings.mouse)return;
  const bounds=($('fox-stage')||root).getBoundingClientRect();
  lookX=clamp((e.clientX-bounds.left-bounds.width*.47)/(bounds.width*.32),-1,1);
  lookY=clamp((e.clientY-bounds.top-bounds.height*.41)/(bounds.height*.3),-1,1);
  if(reduced)settle();
 });
 on($('play-area')||root,'pointerleave',()=>{lookX=0;lookY=0;if(reduced)settle();});
 const editing=e=>e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(e.target.tagName);
 on(options.keyboard===false?null:window,'keydown',e=>{
  if(editing(e))return;
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){
   e.preventDefault();if(paused)setPause(false);
   if(e.code==='ArrowLeft')heldLeft=true;else heldRight=true;
   moveDirection=Number(heldRight)-Number(heldLeft);
  }else if(e.code==='Space'){e.preventDefault();if(!e.repeat)doJump();}
 });
 on(options.keyboard===false?null:window,'keyup',e=>{if(e.code==='ArrowLeft')heldLeft=false;if(e.code==='ArrowRight')heldRight=false;moveDirection=Number(heldRight)-Number(heldLeft);});
 on(window,'blur',()=>{heldLeft=false;heldRight=false;moveDirection=0;});
 on(document,'visibilitychange',()=>{previous=0;if(document.hidden){heldLeft=false;heldRight=false;moveDirection=0;}});
 function motionPreference(){reduced=media.matches;uiSet('motion-note','hidden',!reduced);settle();}
 media.addEventListener('change',motionPreference);
 function destroy(){disposed=true;cancelAnimationFrame(raf);listenerController.abort();media.removeEventListener('change',motionPreference);}
 on(window,'pagehide',destroy);
 uiSet('motion-note','hidden',!reduced);
 settle();raf=requestAnimationFrame(frame);
 return {setFlight:c=>flight?flight.command(c):false,stopFlight:()=>flight?.command({action:'hover'}),flightState:()=>flight?.state()??null,setIntensity:n=>{settings.intensity=clamp(n,0,1);},setMouthPose:p=>{externalMouth=p;if(paused||reduced)settle();},setGesture,cancelActions,setEmotion,setPace,setViseme,stopSpeech,playVisemes,wave:doWave,jump:doJump,blink:doBlink,pause:setPause,reset,destroy,refresh:()=>{if(paused||reduced)settle();else draw();},setEnergy:n=>{if(typeof n!=='number'||!Number.isFinite(n))throw new Error('Energy must be a finite number.');settings.energy=clamp(n,0,1);},getState:()=>({...settings,paused,speech:speech?.name||null,speaking:!!speechQueue,presence:{voice:rig.speechActivity,hands:rig.speechHands},arms:{l:{...tracks.l},r:{...tracks.r}}})};
 }
 host.CharacterMotion={createRig};
})(typeof window!=='undefined'?window:this);
