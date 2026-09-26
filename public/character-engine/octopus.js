/* Octo art: one continuous skin silhouette, eight soft tentacles and a deformable
   mantle. Driven exclusively by octopus-motion.js. */
(function(host){
 'use strict';
 const f=n=>+n.toFixed(3);
 const rest={lx:177,ly:365,rx:434,ry:375,lean:0,squash:1,lift:0,tuck:0,curlL:0,curlR:0};
 const poses={none:{},wave:{rx:432,ry:246,lean:-2.5,curlR:1},think:{rx:393,ry:307,lean:2,curlR:.7},explain:{rx:445,ry:343,lean:-1.5,curlR:.4},celebrate:{lx:176,ly:273,rx:429,ry:265,lean:-1,curlL:.8,curlR:1}};
 const eyes={l:{x:261,y:268,rx:29,ry:36},r:{x:336,y:261,rx:30,ry:38}};
 const body='M182 272 C175 214 215 162 273 153 C338 139 392 173 413 224 C435 278 414 332 383 359 C366 374 357 389 333 391 Q303 397 277 391 C251 384 244 377 225 361 C198 338 184 306 182 272Z';
 // Only the mantle flexes; the lower tips stay on the floor. Roots and the face
 // use the exact same deformation, avoiding a head sitting on detached arms.
 function mantle(q,time,reduced){
  const breath=reduced?0:Math.sin(time*1.65)*.006,sy=q.squash+breath,sx=1/Math.sqrt(sy),angle=q.lean*Math.PI/180;
  const bob=reduced?0:Math.sin(time*1.65)*.7+q.voice*Math.sin(time*3.1)*.5;
  const point=([x,y])=>{const dx=(x-303)*sx,dy=(y-366)*sy;return [303+dx*Math.cos(angle)-dy*Math.sin(angle),366+bob+dx*Math.sin(angle)+dy*Math.cos(angle)];};
  return {point,transform:`translate(303 ${f(366+bob)}) rotate(${f(q.lean)}) scale(${f(sx)} ${f(sy)}) translate(-303 -366)`};
 }
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
   const t=start+(1-start)*i/48,{p,n}=curve(points,t),r=width*Math.pow(1-t,1.1)+2;
   const offset=side===undefined?0:r*.38*side,fade=Math.min(1,Math.max(0,(t-start)/.16)),w=side===undefined?r:r*.48*fade*fade*(3-2*fade);
   a.push(p.map((x,k)=>f(x+n[k]*(offset+w))));b.push(p.map((x,k)=>f(x+n[k]*(offset-w))));
  }
  const end=curve(points,1),cap=end.p.map((v,k)=>f(v+(k===0?end.n[1]:-end.n[0])*4));
  return 'M'+a.map(p=>p.join(' ')).join(' L')+' Q'+cap.join(' ')+' '+b[b.length-1].join(' ')+' L'+b.reverse().map(p=>p.join(' ')).join(' L')+'Z';
 }
 // Union of round swept sections: all subpaths have the same winding, so a
 // tight curl overlaps as solid skin instead of punching a hole or flipping an
 // offset edge. No browser filters or raster skin are involved.
 function tube(points,width,start=0){
  const sections=[];let d='';
  for(let i=0;i<=32;i++){
   const t=start+(1-start)*i/32,{p,n}=curve(points,t),r=width*Math.pow(1-t,1.1)+2;
   sections.push({p,n,r});
   d+=`M${f(p[0]+r)} ${f(p[1])} A${f(r)} ${f(r)} 0 1 1 ${f(p[0]-r)} ${f(p[1])} A${f(r)} ${f(r)} 0 1 1 ${f(p[0]+r)} ${f(p[1])}Z `;
  }
  for(let i=1;i<sections.length;i++){
   const a=sections[i-1],b=sections[i],point=(s,sign)=>s.p.map((v,k)=>v+s.n[k]*s.r*sign);
   let polygon=[point(a,1),point(b,1),point(b,-1),point(a,-1)];
   const area=polygon.reduce((sum,p,j)=>sum+p[0]*polygon[(j+1)%4][1]-polygon[(j+1)%4][0]*p[1],0);
   if(area<0)polygon.reverse();
   d+='M'+polygon.map(p=>p.map(f).join(' ')).join(' L')+'Z ';
  }
  return d;
 }
 function geometry(q,time,reduced){
  const limbs=[],m=mantle(q,time,reduced);
  // Rear limbs are tucked, not displayed as eight identical spokes. Front
  // tentacles rest on a shared floor, with a small asymmetry in their curls.
  const defs=[[-1,0,252,353,225,395], [1,0,354,353,382,395],[-1,1,257,364,214,415],[1,1,351,364,394,415],[-1,2,280,371,278,430],[1,2,326,371,329,428]];
  for(const [sign,layer,x,y,tx,ty]of defs){
   const breath=reduced?0:Math.sin(time*1.65-layer*.7)*1.1,dx=-sign*q.tuck*8,dy=-q.tuck*12;
   limbs.push({id:'base-'+limbs.length,layer,width:layer===2?30:25,side:-sign,points:[m.point([x,y]),m.point([x-sign*5,y+50]),[tx+sign*27+dx,ty+17+dy],[tx+sign*29+dx,ty-7+dy],[tx+sign*31+dx,ty-31+dy],[tx-sign*5+dx,ty-33+breath+dy],[tx-sign*7+dx,ty-14+breath+dy]]});
  }
  for(const side of ['l','r']){
   const sign=side==='l'?-1:1,phase=side==='l'?.8:0,curl=q[side==='l'?'curlL':'curlR'];
   const drift=reduced?0:Math.sin(time*1.65-phase)*.8,x=q[side+'x'],y=q[side+'y']+drift,rootX=303+sign*60;
   // Bend follows a continuous curl channel; movement does not pivot a rigid
   // arm around a shoulder. Matching tangents at the join prevent a kink.
   const reach=8+curl*42;
   limbs.push({id:side,layer:3,width:29,side:-sign,points:[m.point([rootX,332]),m.point([rootX+sign*reach,395-curl*20]),[x+sign*7,y+34],[x+sign*16,y+10],[x+sign*25,y-14],[x-sign*12,y-25],[x-sign*11,y-7]]});
  }
  return limbs;
 }
 function draw(attr,q,time,reduced){
  const m=mantle(q,time,reduced);attr('o-body','transform',m.transform);attr('o-mantle-details','transform',m.transform);
  for(const limb of geometry(q,time,reduced)){
   attr('o-t-'+limb.id,'d',tube(limb.points,limb.width));attr('o-under-'+limb.id,'d',ribbon(limb.points,limb.width,limb.side,.38));
   if(limb.layer===3)attr('o-front-'+limb.id,'d',tube(limb.points,limb.width,.53));
   for(let i=0;i<3;i++){
    const t=.62+i*.11,{p,n,angle}=curve(limb.points,t),r=limb.width*Math.pow(1-t,1.1)+2;
    const transform=`translate(${f(p[0]+n[0]*r*.36*limb.side)} ${f(p[1]+n[1]*r*.36*limb.side)}) rotate(${f(angle)}) scale(${f(r/18)})`;
    attr('o-s-'+limb.id+'-'+i,'transform',transform);
   }
   if(limb.layer===3){const tip=limb.points[6];attr('hand-'+limb.id,'transform',`translate(${tip.map(f).join(' ')})`);}
  }
 }
 function render(p,portrait){
  const limbs=geometry({...rest,voice:0},0,true);
  const tentacle=l=>`<g id="o-limb-${l.id}"><path id="o-under-${l.id}" d="${ribbon(l.points,l.width,l.side,.38)}" fill="#FFAAC2" opacity=".8"/>${[0,1,2].map(i=>{const t=.62+i*.11,{p:pt,n,angle}=curve(l.points,t),r=l.width*Math.pow(1-t,1.1)+2;return `<g id="o-s-${l.id}-${i}" transform="translate(${f(pt[0]+n[0]*r*.36*l.side)} ${f(pt[1]+n[1]*r*.36*l.side)}) rotate(${f(angle)}) scale(${f(r/18)})"><ellipse rx="6.5" ry="5.5" fill="#FFC4D4"/><ellipse rx="3.5" ry="3" fill="#E73A71"/></g>`;}).join('')}</g>`;
  const eye=side=>{const e=eyes[side];return `<g id="m-eye-${side}" transform="translate(${e.x} ${e.y})"><path id="m-white-${side}" d="M-${e.rx} 0 C-${e.rx} -${e.ry*1.333} ${e.rx} -${e.ry*1.333} ${e.rx} 0 C${e.rx} ${e.ry*1.333} -${e.rx} ${e.ry*1.333} -${e.rx} 0Z" fill="#FFFCF6"/><g clip-path="url(#m-eye-clip-${side})"><g id="m-pupil-${side}"><ellipse cx="5" cy="0" rx="15.5" ry="23" fill="#29212C"/><ellipse cx="1" cy="-9" rx="5" ry="7" fill="#FFFFFF"/><circle cx="11" cy="10" r="2.5" fill="#FFFFFF" opacity=".65"/></g></g><path id="m-closed-${side}" fill="none" stroke="#692A43" stroke-width="6" stroke-linecap="round" opacity="0"/><path id="m-brow-${side}" d="M-15 -45 Q0 -54 15 -45" fill="none" stroke="#A72E54" stroke-width="6" stroke-linecap="round" opacity="0"/></g>`;};
  // Paths (rather than ellipses) let the shared eye solver close the complete eye.
  const eyeMarkup=eye('l')+eye('r');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'148 138 315 313':'80 55 445 415'}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="m-title"><title id="m-title">${p.name}</title><defs>
   <radialGradient id="o-skin" gradientUnits="userSpaceOnUse" cx="260" cy="187" r="276"><stop stop-color="#FF81A8"/><stop offset=".48" stop-color="#FF4C83"/><stop offset="1" stop-color="#F2316D"/></radialGradient>
   <mask id="o-silhouette" maskUnits="userSpaceOnUse" x="70" y="70" width="480" height="415"><g fill="white"><path id="o-body" d="${body}"/>${limbs.map(l=>`<path id="o-t-${l.id}" d="${tube(l.points,l.width)}"/>`).join('')}</g></mask>
   ${Object.entries(eyes).map(([s,e])=>`<clipPath id="m-eye-clip-${s}"><path id="m-cut-${s}" d="M-${e.rx} 0 C-${e.rx} -${e.ry*1.333} ${e.rx} -${e.ry*1.333} ${e.rx} 0 C${e.rx} ${e.ry*1.333} -${e.rx} ${e.ry*1.333} -${e.rx} 0Z"/></clipPath>`).join('')}
   <linearGradient id="o-crease" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#D7225D" stop-opacity="0"/><stop offset=".7" stop-color="#D7225D" stop-opacity=".18"/><stop offset="1" stop-color="#D7225D" stop-opacity="0"/></linearGradient>
   <clipPath id="m-mouth-clip"><path id="mouth-cut"/></clipPath></defs>
   <ellipse id="m-shadow" cx="303" cy="445" rx="126" ry="9" fill="#773746" opacity=".1"/>
   <g id="m-character">
    <rect x="90" y="90" width="430" height="385" fill="url(#o-skin)" mask="url(#o-silhouette)"/>
    ${limbs.filter(l=>l.layer===3).map(l=>`<path id="o-front-${l.id}" d="${tube(l.points,l.width,.53)}" fill="url(#o-skin)"/>`).join('')}
    ${limbs.map(l=>tentacle(l)).join('')}
    <g id="o-mantle-details">
     <path d="M281 365 Q280 393 262 414 M326 365 Q326 394 343 412" fill="none" stroke="url(#o-crease)" stroke-width="5" stroke-linecap="round"/>
     <path d="M207 256 C206 214 235 179 269 169" fill="none" stroke="#FFA2BF" stroke-width="8" stroke-linecap="round" opacity=".48"/>
     <ellipse cx="286" cy="165" rx="11" ry="4" fill="#FFB1C7" transform="rotate(-4 286 165)" opacity=".6"/>
    <g id="m-face">${eyeMarkup}
     <g fill="#FFA6BA" opacity=".72"><ellipse cx="236" cy="309" rx="16" ry="9" transform="rotate(12 236 309)"/><ellipse cx="365" cy="297" rx="16" ry="9" transform="rotate(-14 365 297)"/></g>
     <g id="mouth" transform="translate(306 316) scale(1.2 1.3)"><path id="mouth-fill" fill="#64243D"/><g clip-path="url(#m-mouth-clip)"><path id="teeth" fill="#FFF9F1"/><path id="lower-teeth" fill="#FFF9F1"/><ellipse id="tongue" cx="0" cy="18" rx="12" ry="6" fill="#FF8EAD"/></g><path id="mouth-edge" d="M-13 -2 Q0 13 13 -2" fill="none" stroke="#64243D" stroke-width="3" stroke-linecap="round"/></g>
     <g id="m-tears" fill="#73CFE8" opacity="0"><path d="M244 308 Q234 323 244 327 Q254 323 244 308Z"/><path d="M356 298 Q346 313 356 317 Q366 313 356 298Z"/></g>
    </g></g><g id="hand-l"/><g id="hand-r"/>
   </g></svg>`;
 }
 host.OctopusAnatomy={rest,poses,eyes,mouth:{x:306,y:316,sx:1.2,sy:1.3},render,draw};
})(typeof window!=='undefined'?window:this);
