/* Octo anatomy: eight continuous, tapered tentacles. The shared mascot rig owns time,
   expressions, speech and pose blending; this module only draws the octopus. */
(function(host){
 'use strict';
 const f=n=>+n.toFixed(3);
 const rest={lx:166,ly:355,rx:440,ry:351,lean:0,squash:1,lFoot:0,rFoot:0,frontL:0,frontR:0};
 const poses={none:{},wave:{rx:435,ry:235,lean:-5},think:{rx:395,ry:306,lean:5},explain:{rx:452,ry:321,lean:-3},celebrate:{lx:173,ly:252,rx:431,ry:247,lean:0,squash:1.025}};
 const eyes={l:{x:263,y:265,rx:27,ry:35},r:{x:335,y:253,rx:29,ry:37}};
 // Sample two joined Beziers. Normal offsets make the silhouette, underside and
 // suckers travel together, including when a gesture changes mid-curve.
 function curve(points,t){
  const second=t>.5,u=second?(t-.5)*2:t*2,i=second?3:0,[a,b,c,d]=points.slice(i,i+4),v=1-u;
  const p=[0,1].map(k=>v*v*v*a[k]+3*v*v*u*b[k]+3*v*u*u*c[k]+u*u*u*d[k]);
  const tangent=[0,1].map(k=>3*v*v*(b[k]-a[k])+6*v*u*(c[k]-b[k])+3*u*u*(d[k]-c[k])),len=Math.hypot(...tangent)||1;
  return {p,n:[-tangent[1]/len,tangent[0]/len],angle:Math.atan2(tangent[1],tangent[0])*180/Math.PI};
 }
 function ribbon(points,width,side,start=0){
  const a=[],b=[];
  for(let i=0;i<=48;i++){
   const t=start+(1-start)*i/48,{p,n}=curve(points,t),r=width*Math.pow(1-t,.65)+2;
   const offset=side===undefined?0:r*.38*side,w=side===undefined?r:r*.48*Math.min(1,t/.28);
   a.push(p.map((x,k)=>f(x+n[k]*(offset+w))));b.push(p.map((x,k)=>f(x+n[k]*(offset-w))));
  }
  return 'M'+a.map(p=>p.join(' ')).join(' L')+' L'+b.reverse().map(p=>p.join(' ')).join(' L')+'Z';
 }
 function geometry(q,time,reduced){
  const limbs=[];
  // Six lower tentacles: rear pair, outside pair, front pair. Roots overlap well
  // inside the dome, so the animal never acquires a wrist or a separate leg joint.
  const defs=[[-1,0,250,361,204,403], [1,0,356,361,401,405],[-1,1,247,374,190,433],[1,1,359,374,415,431],[-1,2,285,380,261,454],[1,2,321,380,346,453]];
  for(const [sign,layer,x,y,tx,ty]of defs){
   const drift=reduced?0:Math.sin(time*1.7+layer*.85+sign*.4)*(layer===2?1.2:2.3),lift=q[sign<0?'lFoot':'rFoot']*.12;
   limbs.push({id:'base-'+limbs.length,layer,width:layer===2?29:22,side:-sign,points:[[x,y],[x+sign*8,y+37],[tx+sign*35,ty+17+lift],[tx+sign*33,ty-3+drift+lift],[tx+sign*31,ty-23+drift+lift],[tx+sign*5,ty-23+drift+lift],[tx,ty-8+drift+lift]]});
  }
  for(const side of ['l','r']){
   const sign=side==='l'?-1:1,x=q[side+'x'],y=q[side+'y'],rootX=303+sign*77;
   limbs.push({id:side,layer:3,width:25,side:-sign,points:[[rootX,342],[rootX+sign*49,394],[x+sign*23,y+48],[x+sign*22,y+16],[x+sign*21,y-16],[x-sign*13,y-19],[x-sign*10,y+3]]});
  }
  return limbs;
 }
 function draw(attr,q,time,reduced){
  for(const limb of geometry(q,time,reduced)){
   attr('o-t-'+limb.id,'d',ribbon(limb.points,limb.width));attr('o-under-'+limb.id,'d',ribbon(limb.points,limb.width,limb.side));
   if(limb.layer===3){attr('o-front-'+limb.id,'d',ribbon(limb.points,limb.width,undefined,.5));attr('o-front-under-'+limb.id,'d',ribbon(limb.points,limb.width,limb.side,.5));}
   for(let i=0;i<3;i++){
    const t=.55+i*.15,{p,n,angle}=curve(limb.points,t),r=limb.width*Math.pow(1-t,.65)+2;
    const transform=`translate(${f(p[0]+n[0]*r*.36*limb.side)} ${f(p[1]+n[1]*r*.36*limb.side)}) rotate(${f(angle)}) scale(${f(r/18)})`;
    attr('o-s-'+limb.id+'-'+i,'transform',transform);if(limb.layer===3)attr('o-front-s-'+limb.id+'-'+i,'transform',transform);
   }
   if(limb.layer===3){const tip=limb.points[6];attr('hand-'+limb.id,'transform',`translate(${tip.map(f).join(' ')})`);}
  }
 }
 function render(p,portrait){
  const limbs=geometry(rest,0,true),tentacle=(l,front=false)=>{const start=front ? .5 : 0,bodyId=front?'o-front-':'o-t-',underId=front?'o-front-under-':'o-under-',suckerId=front?'o-front-s-':'o-s-';return `<g id="o-${front?'front-':''}limb-${l.id}"><path id="${bodyId+l.id}" d="${ribbon(l.points,l.width,undefined,start)}" fill="url(#o-skin)"/><path id="${underId+l.id}" d="${ribbon(l.points,l.width,l.side,start)}" fill="#FFAAC2" opacity=".8"/>${[0,1,2].map(i=>{const t=.55+i*.15,{p:pt,n,angle}=curve(l.points,t),r=l.width*Math.pow(1-t,.65)+2;return `<g id="${suckerId+l.id}-${i}" transform="translate(${f(pt[0]+n[0]*r*.36*l.side)} ${f(pt[1]+n[1]*r*.36*l.side)}) rotate(${f(angle)}) scale(${f(r/18)})"><ellipse rx="6.5" ry="5.5" fill="#FFC4D4"/><ellipse rx="3.5" ry="3" fill="#E73A71"/></g>`;}).join('')}</g>`;};
  const eye=side=>{const e=eyes[side];return `<g id="m-eye-${side}" transform="translate(${e.x} ${e.y})"><path id="m-white-${side}" d="M-${e.rx} 0 C-${e.rx} -${e.ry*1.333} ${e.rx} -${e.ry*1.333} ${e.rx} 0 C${e.rx} ${e.ry*1.333} -${e.rx} ${e.ry*1.333} -${e.rx} 0Z" fill="#FFFCF6"/><g clip-path="url(#m-eye-clip-${side})"><g id="m-pupil-${side}"><ellipse cx="5" cy="0" rx="15.5" ry="23" fill="#29212C"/><ellipse cx="1" cy="-9" rx="5" ry="7" fill="#FFFFFF"/><circle cx="11" cy="10" r="2.5" fill="#FFFFFF" opacity=".65"/></g></g><path id="m-closed-${side}" fill="none" stroke="#692A43" stroke-width="6" stroke-linecap="round" opacity="0"/><path id="m-brow-${side}" d="M-15 -45 Q0 -54 15 -45" fill="none" stroke="#A72E54" stroke-width="6" stroke-linecap="round" opacity="0"/></g>`;};
  // Paths (rather than ellipses) let the shared eye solver close the complete eye.
  const eyeMarkup=eye('l')+eye('r');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'163 140 278 306':'60 15 490 505'}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="m-title"><title id="m-title">${p.name}</title><defs>
   <linearGradient id="o-skin" gradientUnits="userSpaceOnUse" x1="180" y1="210" x2="390" y2="470"><stop stop-color="#FF5B8B"/><stop offset=".58" stop-color="#FF467E"/><stop offset="1" stop-color="#F3326D"/></linearGradient>
   <radialGradient id="o-glow" cx=".29" cy=".18" r=".88"><stop stop-color="#FF77A0"/><stop offset=".45" stop-color="#FF4A81"/><stop offset="1" stop-color="#F53670"/></radialGradient>
   ${Object.entries(eyes).map(([s,e])=>`<clipPath id="m-eye-clip-${s}"><path id="m-cut-${s}" d="M-${e.rx} 0 C-${e.rx} -${e.ry*1.333} ${e.rx} -${e.ry*1.333} ${e.rx} 0 C${e.rx} ${e.ry*1.333} -${e.rx} ${e.ry*1.333} -${e.rx} 0Z"/></clipPath>`).join('')}
   <clipPath id="m-mouth-clip"><path id="mouth-cut"/></clipPath></defs>
   <ellipse id="m-shadow" cx="303" cy="477" rx="132" ry="10" fill="#773746" opacity=".1"/>
   <g id="m-character"><g id="m-upper">
    ${limbs.map(l=>tentacle(l)).join('')}
    <path d="M189 275 C182 214 219 163 274 153 C332 140 382 168 403 219 C426 273 408 329 376 365 C343 402 282 404 240 378 C207 357 190 316 189 275Z" fill="url(#o-glow)"/>
    <path d="M211 270 C205 216 233 178 274 169" fill="none" stroke="#FF9DB9" stroke-width="9" stroke-linecap="round" opacity=".45"/>
    <ellipse cx="290" cy="164" rx="12" ry="4.5" fill="#FFACBF" transform="rotate(-4 290 164)" opacity=".65"/>
    <path d="M399 268 C403 333 362 386 307 389 C352 369 373 333 383 292Z" fill="#E72861" opacity=".18"/>
    ${limbs.filter(l=>l.layer===3).map(l=>tentacle(l,true)).join('')}
    <g id="m-face">${eyeMarkup}
     <g fill="#FFA6BA" opacity=".72"><ellipse cx="236" cy="309" rx="16" ry="9" transform="rotate(12 236 309)"/><ellipse cx="365" cy="297" rx="16" ry="9" transform="rotate(-14 365 297)"/></g>
     <g id="mouth" transform="translate(306 316) scale(1.2 1.3)"><path id="mouth-fill" fill="#64243D"/><g clip-path="url(#m-mouth-clip)"><path id="teeth" fill="#FFF9F1"/><path id="lower-teeth" fill="#FFF9F1"/><ellipse id="tongue" cx="0" cy="18" rx="12" ry="6" fill="#FF8EAD"/></g><path id="mouth-edge" d="M-13 -2 Q0 13 13 -2" fill="none" stroke="#64243D" stroke-width="3" stroke-linecap="round"/></g>
     <g id="m-tears" fill="#73CFE8" opacity="0"><path d="M244 308 Q234 323 244 327 Q254 323 244 308Z"/><path d="M356 298 Q346 313 356 317 Q366 313 356 298Z"/></g>
    </g><g id="hand-l"/><g id="hand-r"/>
   </g></g></svg>`;
 }
 host.OctopusAnatomy={rest,poses,eyes,mouth:{x:306,y:316,sx:1.2,sy:1.3},shadowY:477,render,draw};
})(typeof window!=='undefined'?window:this);
