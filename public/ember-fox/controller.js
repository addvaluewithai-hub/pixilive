/* Ember: one persistent SVG, parameterized face and two-bone arm rig.
   No bitmap frames, character replacement, external libraries or network calls. */
(() => {
 'use strict';
 const root = document.getElementById('fox-app');
 const $ = id => root.querySelector('#' + id);
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
  mouthW:23,mouthTop:11,mouthBottom:29,mouthY:0,mouthX:0,teeth:.9,tongue:1,
  headR:0,headY:0,earL:0,earR:0,handLX:219,handLY:414,handRX:384,handRY:414,
  tears:0,blush:1,gazeX:0,gazeY:0,pupil:1,closedSmile:1,sob:0,laugh:0};
 const emotions = {
  happy: {...base},
  sad: {...base,openL:.74,openR:.74,browLY:3,browRY:3,browLR:-23,browRR:23,
   mouthW:16,mouthTop:-8,mouthBottom:-6,mouthY:7,teeth:0,tongue:0,
   headR:-4,headY:5,earL:-12,earR:12,gazeY:4,handLX:235,handLY:428,handRX:371,handRY:428,blush:.3},
  crying: {...base,openL:.46,openR:.46,bottom:.65,browLR:-28,browRR:28,browLY:6,browRY:6,
   mouthW:15,mouthTop:-10,mouthBottom:18,mouthY:7,teeth:0,tongue:.6,
   headY:4,earL:-16,earR:16,handLX:214,handLY:298,handRX:391,handRY:298,tears:1,blush:.35,sob:1},
  surprised: {...base,openL:1.21,openR:1.21,bottom:1.07,browLY:-15,browRY:-15,
   mouthW:12,mouthTop:-18,mouthBottom:23,mouthY:12,teeth:0,tongue:0,
   headY:-4,earL:4,earR:-4,handLX:203,handLY:312,handRX:403,handRY:312,pupil:.88,blush:.45},
  thinking: {...base,openL:.63,openR:1.05,browLY:9,browRY:-11,browLR:10,browRR:7,
   mouthW:11,mouthTop:1,mouthBottom:3,mouthY:7,mouthX:8,teeth:0,tongue:0,
   headR:-6,earL:-8,earR:4,handLX:246,handLY:410,handRX:335,handRY:322,gazeX:9,gazeY:-7,blush:.45},
  angry: {...base,openL:.52,openR:.52,tilt:13,bottom:.85,browLY:12,browRY:12,browLR:22,browRR:-22,
   mouthW:18,mouthTop:-7,mouthBottom:-4,mouthY:7,teeth:0,tongue:0,
   headY:4,earL:-12,earR:12,handLX:327,handLY:390,handRX:284,handRY:407,blush:.7,pupil:.93},
  sleepy: {...base,openL:.19,openR:.19,bottom:.52,browLY:6,browRY:6,browLR:-5,browRR:5,
   mouthW:12,mouthTop:6,mouthBottom:8,mouthY:1,teeth:0,tongue:0,
   headR:7,headY:7,earL:-9,earR:12,gazeY:6,handLX:234,handLY:431,handRX:373,handRY:428,blush:.45,closedSmile:-.4},
  laughing: {...base,openL:.025,openR:.025,bottom:.25,browLY:5,browRY:5,
   mouthW:28,mouthTop:3,mouthBottom:37,mouthY:-1,teeth:1,tongue:1,
   headR:-3,headY:-3,handLX:268,handLY:400,handRX:340,handRY:399,blush:1.25,laugh:1},
  excited: {...base,openL:.91,openR:.91,browLY:-7,browRY:-7,
   mouthW:26,mouthTop:7,mouthBottom:34,mouthY:0,teeth:1,tongue:1,
   headY:-5,earL:5,earR:-5,handLX:165,handLY:294,handRX:442,handRY:292,blush:1.2}
 };
 const labels = {happy:'مبسوط',sad:'زعلان',crying:'بيعيّط',surprised:'متفاجئ',thinking:'بيفكّر',angry:'متعصّب',sleepy:'نعسان',laughing:'بيضحك',excited:'متحمّس'};
 const settings = {emotion:'happy',intensity:1,energy:.5,walkSpeed:0,wave:0,gazeX:0,gazeY:0,mouse:true};
 const rig = {...base,walk:0,energy:.5,wave:0,lookX:0,lookY:0,tail:0};
 const velocity = Object.fromEntries(Object.keys(rig).map(k=>[k,0]));
 let paused=false, time=0, previous=0, raf=0, disposed=false, phase=0;
 let blinkStart=-99, nextBlink=2.5, waveUntil=0, jumpStart=-99;
 let travel=0, moveDirection=0, lookX=0, lookY=0;
 let heldLeft=false, heldRight=false;
 const listenerController = new AbortController();
 const on = (el, event, fn) => el.addEventListener(event, fn, {signal:listenerController.signal});

 // Exact critically damped update, stable across refresh rates and long frames.
 function smooth(key, target, dt, omega=12) {
  const x=rig[key]-target, v=velocity[key], exp=Math.exp(-omega*dt);
  rig[key]=target+(x+(v+omega*x)*dt)*exp;
  velocity[key]=(v-omega*(v+omega*x)*dt)*exp;
 }
 function setEmotion(name) {
  if (!emotions[name]) return;
  settings.emotion=name;
  all('[data-emotion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emotion===name)));
  $('current-emotion').textContent=labels[name];
  if(paused || reduced) settle();
 }
 function syncPace(){
  all('[data-pace]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pace)===settings.walkSpeed)));
  $('walk-speed').value=Math.round(settings.walkSpeed*100);
  $('walk-speed-value').textContent=Math.round(settings.walkSpeed*100)+'%';
 }
 function setPace(n){settings.walkSpeed=clamp(n,0,1);syncPace();if(paused||reduced)settle();}
 function setPause(value){
  paused=value;$('pause').setAttribute('aria-pressed',String(paused));
  $('pause').textContent=paused?'كمّل الحركة':'تجميد الحركة';
  previous=0;
 }
 function announce(text){$('action-status').textContent=text;}
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
  waveUntil=0;jumpStart=-99;blinkStart=-99;nextBlink=time+3;
  for(const [id,n] of [['intensity',100],['energy',50],['walk-speed',0],['wave',0],['gaze-x',0],['gaze-y',0]]){
   $(id).value=n;$(id+'-value').textContent=n+(id.startsWith('gaze')?'':'%');
  }
  $('mouse-gaze').checked=true;setPause(false);setPace(0);setEmotion('happy');
 }
 function targets(){
  const result={};
  for(const k of Object.keys(base))result[k]=lerp(base[k],emotions[settings.emotion][k],settings.intensity);
  result.walk=reduced?0:Math.max(settings.walkSpeed,moveDirection?.55:0);
  result.energy=settings.energy;
  result.wave=Math.max(settings.wave,time<waveUntil?1:0);
  result.lookX=(settings.mouse?lookX:settings.gazeX)*10+result.gazeX;
  result.lookY=(settings.mouse?lookY:settings.gazeY)*7+result.gazeY;
  return result;
 }
 function settle(){const goal=targets();for(const k in goal){rig[k]=goal[k];velocity[k]=0;}draw();}
 function eye(side, open, blink){
  const close=1-blink;
  const w=25.5, top=43*clamp(open*close,.007,1.3), bottom=35*rig.bottom*close;
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
 function arm(side, px, py, handAngle=0){
  const sx=side==='l'?247:356, sy=357, sign=side==='l'?1:-1;
  let dx=px-sx, dy=py-sy, d=Math.max(1,Math.hypot(dx,dy));
  // Preserve the elbow bend, allowing a small soft stretch for raised poses.
  const stretch=Math.max(1,d/75.8), a=36*stretch,b=43*stretch;
  const along=(a*a-b*b+d*d)/(2*d), height=Math.sqrt(Math.max(0,a*a-along*along));
  let ex=sx+dx/d*along-dy/d*height*sign;
  let ey=sy+dy/d*along+dx/d*height*sign;
  // Keep the elbow below/outside the cheek on high poses; blend this
  // art-directed constraint continuously to avoid an IK branch flip.
  const raised=clamp((359-py)/42,0,1);
  ex=lerp(ex,side==='l'?202+(px-214)*.25:400+(px-391)*.25,raised);
  ey=lerp(ey,353,raised);
  attr('upper-arm-'+side,'d',`M${sx} ${sy} Q${fmt((sx+ex)/2)} ${fmt((sy+ey)/2-2)} ${fmt(ex)} ${fmt(ey)}`);
  attr('lower-arm-'+side,'d',`M${fmt(ex)} ${fmt(ey)} Q${fmt((ex+px)/2)} ${fmt((ey+py)/2)} ${fmt(px)} ${fmt(py)}`);
  const angle=clamp(-Math.atan2(px-ex,py-ey)*180/Math.PI,-150,150)+handAngle;
  transform('hand-'+side,`translate(${fmt(px)} ${fmt(py)}) rotate(${fmt(angle)})`);
 }
 function draw(){
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
  const headR=rig.headR+idle*.6+rig.lookX*.055;
  const headY=rig.headY-idle*.6+sob*.3;
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
  transform('brow-l',`translate(0 ${fmt(rig.browLY)}) rotate(${fmt(rig.browLR)} 242 181)`);
  transform('brow-r',`translate(0 ${fmt(rig.browRY)}) rotate(${fmt(rig.browRR)} 360 181)`);
  const w=rig.mouthW, y=rig.mouthY;
  const upper=`M${fmt(-w)} ${fmt(y)} C${fmt(-w*.5)} ${fmt(rig.mouthTop+y)} ${fmt(w*.5)} ${fmt(rig.mouthTop+y)} ${fmt(w)} ${fmt(y)}`;
  const path=upper+` C${fmt(w*.67)} ${fmt(rig.mouthBottom+y)} ${fmt(-w*.67)} ${fmt(rig.mouthBottom+y)} ${fmt(-w)} ${fmt(y)}Z`;
  attr('mouth-fill','d',path);attr('mouth-cut','d',path);attr('mouth-edge','d',upper);
  transform('mouth',`translate(${fmt(302+rig.mouthX)} 302)`);
  opacity('teeth',rig.teeth);opacity('tongue',rig.tongue);
  opacity('muzzle-smile',clamp(rig.mouthTop/10,0,1));
  opacity('blush-l',rig.blush);opacity('blush-r',rig.blush);
  opacity('tears',rig.tears);
  transform('tear-l',`translate(0 ${fmt(motion*(Math.sin(time*4)+1)*3)})`);
  transform('tear-r',`translate(0 ${fmt(motion*(Math.sin(time*4+1.6)+1)*3)})`);
  // Raised paws follow the moving head instead of sliding across the cheeks.
  const followHead=(x,y)=>{
   const weight=clamp((352-y)/44,0,1), a=headR*Math.PI/180;
   return [lerp(x,302+(x-302)*Math.cos(a)-(y-327)*Math.sin(a),weight),lerp(y,327+(x-302)*Math.sin(a)+(y-327)*Math.cos(a)+headY,weight)];
  };
  let [lx,ly]=followHead(rig.handLX,rig.handLY);
  let [rx,ry]=followHead(rig.handRX,rig.handRY);
  const walkInfluence=stride*(1-.8*settings.intensity*(settings.emotion==='happy'?0:1));
  lx+=gait*6*walkInfluence;ly+=gait*14*walkInfluence;
  rx-=gait*6*walkInfluence;ry-=gait*14*walkInfluence;
  const waveMotion=Math.sin(time*8)*motion;
  rx=lerp(rx,439+waveMotion*8,rig.wave);ry=lerp(ry,295+Math.cos(time*8)*3*motion,rig.wave);
  arm('l',lx,ly);arm('r',rx,ry,waveMotion*14*rig.wave);
 }
 function frame(now){
  if(disposed)return;
  const dt=previous?Math.min((now-previous)/1000,.05):1/60;previous=now;
  if(!paused && !document.hidden){
   time+=dt;
   if(!reduced && time>nextBlink){blinkStart=time;nextBlink=time+3.2+Math.random()*2.6;}
   const goal=targets();
   for(const key in goal)smooth(key,goal[key],dt,key==='lookX'||key==='lookY'?15:key==='wave'?10:11);
   const tailGoal=reduced?0:Math.sin(time*2.5-.5)*(2.3+rig.energy*3)+Math.sin(phase-.7)*rig.walk*4;
   smooth('tail',tailGoal,dt,7);
   if(!reduced){phase+=dt*(4+rig.walk*6)*rig.walk;travel=clamp(travel+moveDirection*dt*65,-93,61);}
   draw();
  }
  raf=requestAnimationFrame(frame);
 }
 all('[data-emotion]').forEach(b=>on(b,'click',()=>setEmotion(b.dataset.emotion)));
 all('[data-pace]').forEach(b=>on(b,'click',()=>setPace(Number(b.dataset.pace))));
 on($('wave-action'),'click',doWave);on($('jump-action'),'click',doJump);on($('blink-action'),'click',doBlink);
 on($('character'),'click',doBlink);on($('pause'),'click',()=>setPause(!paused));on($('reset'),'click',reset);
 const inputMap={'intensity':'intensity','energy':'energy','walk-speed':'walkSpeed','wave':'wave','gaze-x':'gazeX','gaze-y':'gazeY'};
 for(const [id,key] of Object.entries(inputMap)){
  on($(id),'input',e=>{
   settings[key]=Number(e.target.value)/100;
   $(id+'-value').textContent=e.target.value+(id.startsWith('gaze')?'':'%');
   if(id.startsWith('gaze')){settings.mouse=false;$('mouse-gaze').checked=false;}
   if(id==='walk-speed')syncPace();
   if(paused||reduced)settle();
  });
 }
 on($('mouse-gaze'),'change',e=>{settings.mouse=e.target.checked;if(paused||reduced)settle();});
 on($('play-area'),'pointermove',e=>{
  if(!settings.mouse)return;
  const bounds=$('fox-stage').getBoundingClientRect();
  lookX=clamp((e.clientX-bounds.left-bounds.width*.47)/(bounds.width*.32),-1,1);
  lookY=clamp((e.clientY-bounds.top-bounds.height*.41)/(bounds.height*.3),-1,1);
  if(reduced)settle();
 });
 on($('play-area'),'pointerleave',()=>{lookX=0;lookY=0;if(reduced)settle();});
 const editing=e=>e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(e.target.tagName);
 on(window,'keydown',e=>{
  if(editing(e))return;
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){
   e.preventDefault();if(paused)setPause(false);
   if(e.code==='ArrowLeft')heldLeft=true;else heldRight=true;
   moveDirection=Number(heldRight)-Number(heldLeft);
  }else if(e.code==='Space'){e.preventDefault();if(!e.repeat)doJump();}
 });
 on(window,'keyup',e=>{if(e.code==='ArrowLeft')heldLeft=false;if(e.code==='ArrowRight')heldRight=false;moveDirection=Number(heldRight)-Number(heldLeft);});
 on(window,'blur',()=>{heldLeft=false;heldRight=false;moveDirection=0;});
 on(document,'visibilitychange',()=>{previous=0;if(document.hidden){heldLeft=false;heldRight=false;moveDirection=0;}});
 function motionPreference(){reduced=media.matches;$('motion-note').hidden=!reduced;settle();}
 media.addEventListener('change',motionPreference);
 on(window,'pagehide',()=>{disposed=true;cancelAnimationFrame(raf);listenerController.abort();media.removeEventListener('change',motionPreference);});
 $('motion-note').hidden=!reduced;
 settle();raf=requestAnimationFrame(frame);
})();
