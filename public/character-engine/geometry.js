/* Shared pure geometry: one continuous arm silhouette and one mouth topology. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CharacterGeometry=factory();})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,f=v=>+v.toFixed(3);
 const mouthBase={mouthOpen:0,mouthSmile:0,mouthWidth:1,mouthRound:0,mouthPress:0,mouthTeeth:0,mouthLowerTeeth:0,mouthTongue:0,mouthOffset:0};
 const expressionMouth={
  happy:{...mouthBase,mouthOpen:.62,mouthSmile:.72,mouthWidth:.98,mouthTeeth:.8,mouthTongue:.55},
  sad:{...mouthBase,mouthSmile:-.7,mouthWidth:.72},
  crying:{...mouthBase,mouthOpen:.48,mouthSmile:-.65,mouthWidth:.78,mouthRound:.45,mouthTongue:.3},
  surprised:{...mouthBase,mouthOpen:.88,mouthWidth:.83,mouthRound:1},
  thinking:{...mouthBase,mouthSmile:.08,mouthWidth:.58,mouthOffset:7},
  angry:{...mouthBase,mouthOpen:.018,mouthSmile:-.57,mouthWidth:.8,mouthPress:.3},
  sleepy:{...mouthBase,mouthOpen:.05,mouthSmile:.15,mouthWidth:.64,mouthRound:.15},
  laughing:{...mouthBase,mouthOpen:.92,mouthSmile:.9,mouthWidth:1.15,mouthTeeth:1,mouthTongue:.75},
  excited:{...mouthBase,mouthOpen:.72,mouthSmile:.75,mouthWidth:1.06,mouthTeeth:.9,mouthTongue:.65}
 };
 const visemes={
  REST:{...mouthBase,mouthWidth:.78},
  MBP:{...mouthBase,mouthWidth:.82,mouthPress:1},
  AA:{...mouthBase,mouthOpen:1,mouthWidth:.97,mouthRound:.15,mouthTeeth:.12,mouthTongue:.65},
  EE:{...mouthBase,mouthOpen:.29,mouthWidth:1.16,mouthSmile:.2,mouthTeeth:1,mouthLowerTeeth:.45},
  IH:{...mouthBase,mouthOpen:.38,mouthWidth:.86,mouthTeeth:.6,mouthTongue:.2},
  OH:{...mouthBase,mouthOpen:.79,mouthWidth:.9,mouthRound:.94,mouthTongue:.1},
  OO:{...mouthBase,mouthOpen:.38,mouthWidth:.62,mouthRound:1},
  FV:{...mouthBase,mouthOpen:.16,mouthWidth:.88,mouthPress:.7,mouthTeeth:1},
  L:{...mouthBase,mouthOpen:.56,mouthWidth:.91,mouthTeeth:.7,mouthTongue:1},
  S:{...mouthBase,mouthOpen:.16,mouthWidth:1.02,mouthTeeth:1,mouthLowerTeeth:.85},
  CH:{...mouthBase,mouthOpen:.28,mouthWidth:.76,mouthRound:.65,mouthTeeth:.8},
  WQ:{...mouthBase,mouthOpen:.24,mouthWidth:.65,mouthRound:1}
 };
 function cubic(a,b,c,d,t){const u=1-t;return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];}
 function derivative(a,b,c,d,t){const u=1-t;return [3*u*u*(b[0]-a[0])+6*u*t*(c[0]-b[0])+3*t*t*(d[0]-c[0]),3*u*u*(b[1]-a[1])+6*u*t*(c[1]-b[1])+3*t*t*(d[1]-c[1])];}
 function curveThrough(points){
  let d='';for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];d+=` C${f(p1[0]+(p2[0]-p0[0])/6)} ${f(p1[1]+(p2[1]-p0[1])/6)} ${f(p2[0]-(p3[0]-p1[0])/6)} ${f(p2[1]-(p3[1]-p1[1])/6)} ${f(p2[0])} ${f(p2[1])}`;}return d;
 }
 function arm({side,x,y,body=1,wave=0}){
  const sign=side==='l'?-1:1,s=[302+sign*52*body,367];
  const rawDistance=Math.hypot(x-s[0],y-s[1]),reach=104;
  if(rawDistance>reach){x=s[0]+(x-s[0])*reach/rawDistance;y=s[1]+(y-s[1])*reach/rawDistance;}
  // A single bowed centerline. Its curvature is bounded relative to reach,
  // so short/cross-body poses cannot produce a folded elbow silhouette.
  const dx=x-s[0],dy=y-s[1],distance=Math.max(1,Math.hypot(dx,dy)),normal=[-dy/distance,dx/distance];
  const bow=clamp(sign*24*normal[0]+25*normal[1],-distance*.24,distance*.24);
  const control=[(s[0]+x)/2+normal[0]*bow,(s[1]+y)/2+normal[1]*bow];
  const end=[x,y],c1=[s[0]+(control[0]-s[0])*2/3,s[1]+(control[1]-s[1])*2/3];
  const baseAngle=Math.atan2(-(x-control[0]),y-control[1]),radians=baseAngle+wave*Math.PI/180,angle=radians*180/Math.PI;
  const tangent=[-Math.sin(radians),Math.cos(radians)],handle=Math.hypot(x-control[0],y-control[1])*2/3;
  const c2=[x-tangent[0]*handle,y-tangent[1]*handle];
  const left=[],right=[],radius=17.8*clamp(.97+(body-1)*.2,.94,1.03);
  for(let i=0;i<=12;i++){
   const t=i/12,p=cubic(s,c1,c2,end,t),v=derivative(s,c1,c2,end,t),len=Math.max(.001,Math.hypot(...v)),n=[-v[1]/len,v[0]/len];
   const wrist=12.5+2.5*Math.exp(-Math.pow(t/.32,2));
   const palm=clamp((t-.68)/.32,0,1),w=mix(wrist,radius,palm*palm*(3-2*palm));
   left.push([p[0]+n[0]*w,p[1]+n[1]*w]);right.push([p[0]-n[0]*w,p[1]-n[1]*w]);
  }
  const n=[-tangent[1],tangent[0]],tip=[x+tangent[0]*radius,y+tangent[1]*radius],a=left.at(-1),b=right.at(-1),k=.5522848;
  function outline(start){
  let d=`M${f(left[start][0])} ${f(left[start][1])}`+curveThrough(left.slice(start));
  d+=` C${f(a[0]+tangent[0]*radius*k)} ${f(a[1]+tangent[1]*radius*k)} ${f(tip[0]+n[0]*radius*k)} ${f(tip[1]+n[1]*radius*k)} ${f(tip[0])} ${f(tip[1])}`;
  d+=` C${f(tip[0]-n[0]*radius*k)} ${f(tip[1]-n[1]*radius*k)} ${f(b[0]+tangent[0]*radius*k)} ${f(b[1]+tangent[1]*radius*k)} ${f(b[0])} ${f(b[1])}`;
  d+=curveThrough(right.slice(start).reverse());
  // Opaque rounded shoulder: the whole limb stays visible in every pose.
  const startTangent=[(c1[0]-s[0]),(c1[1]-s[1])],len=Math.max(.001,Math.hypot(...startTangent)),u=startTangent.map(v=>v/len),rr=15;
  const r=right[0],l=left[0],back=[s[0]-u[0]*rr,s[1]-u[1]*rr],normal=[-u[1],u[0]];
  d+=` C${f(r[0]-u[0]*rr*k)} ${f(r[1]-u[1]*rr*k)} ${f(back[0]-normal[0]*rr*k)} ${f(back[1]-normal[1]*rr*k)} ${f(back[0])} ${f(back[1])}`;
  d+=` C${f(back[0]+normal[0]*rr*k)} ${f(back[1]+normal[1]*rr*k)} ${f(l[0]-u[0]*rr*k)} ${f(l[1]-u[1]*rr*k)} ${f(l[0])} ${f(l[1])} Z`;return d;
  }
  const d=outline(0);
  return {d,x:f(x),y:f(y),angle:f(angle),length:rawDistance,centerline:[s,c1,c2,end],attributes:{
   ['arm-'+side]:{d},['hand-'+side]:{transform:`translate(${f(x)} ${f(y)}) rotate(${f(angle)})`},
   ['arm-skin-'+side]:{x1:s[0],y1:s[1],x2:f(x),y2:f(y)}
  }};
 }
 function mouth(raw,species='fox'){
  const p={...mouthBase,...raw},open=p.mouthOpen<.001?0:clamp(p.mouthOpen,0,1),smile=clamp(p.mouthSmile,-1,1),round=clamp(p.mouthRound,0,1);
  const w=mix(23,14,round)*clamp(p.mouthWidth,.45,1.3),cy=-smile*4.3;
  const top=mix(smile*4.3,-11*open,round*.85),bottom=top+open*(23+round*6);
  const k=mix(.52,.6,round),lowerShoulder=Math.max(top,cy+(bottom-cy)*.72);
  const upper=`M${f(-w)} ${f(cy)} C${f(-w*.93)} ${f(top)} ${f(-w*k)} ${f(top)} 0 ${f(top)} C${f(w*k)} ${f(top)} ${f(w*.93)} ${f(top)} ${f(w)} ${f(cy)}`;
  const d=upper+` C${f(w*.93)} ${f(lowerShoulder)} ${f(w*k)} ${f(bottom)} 0 ${f(bottom)} C${f(-w*k)} ${f(bottom)} ${f(-w*.93)} ${f(lowerShoulder)} ${f(-w)} ${f(cy)} Z`;
  const cavity=clamp(open*16,0,1),teeth=clamp(p.mouthTeeth,0,1)*cavity,tongue=clamp(p.mouthTongue,0,1)*cavity;
  const toothY=top-2,toothBottom=top+5.5,tw=w*.87;
  const teethD=species==='rabbit'?`M-9 ${f(toothY)} H9 V${f(toothBottom+4)} Q5 ${f(toothBottom+7)} 1 ${f(toothBottom+4)} L0 ${f(toothBottom)} L-1 ${f(toothBottom+4)} Q-5 ${f(toothBottom+7)}-9 ${f(toothBottom+4)}Z`:`M${f(-tw)} ${f(toothY)} H${f(tw)} L${f(tw*.93)} ${f(toothBottom-1)} Q0 ${f(toothBottom+3)} ${f(-tw*.93)} ${f(toothBottom-1)} Z`;
  const tongueY=mix(bottom+1.4,top+9,clamp((p.mouthTongue-.75)*4,0,1));
  return {open,w,top,bottom,lowerShoulder,attributes:{
   mouth:{transform:`translate(${f(302+p.mouthOffset)} 307)`},'mouth-cut':{d},'mouth-fill':{d,opacity:cavity},
   'mouth-edge':{d:upper,'stroke-width':f(2.25+p.mouthPress*.75)},
   teeth:{d:teethD,opacity:teeth,transform:''},
   'lower-teeth':{d:`M${f(-w*.75)} ${f(bottom-4)} Q0 ${f(bottom-7)} ${f(w*.75)} ${f(bottom-4)} L${f(w*.8)} ${f(bottom+4)} H${f(-w*.8)}Z`,opacity:clamp(p.mouthLowerTeeth,0,1)*cavity},
   tongue:{cx:0,cy:f(tongueY),rx:f(Math.min(w*.64,15)),ry:6.5,opacity:tongue},
   'muzzle-smile':{d:'M302 288 Q302 293 302 296',opacity:f(.4*(1-round*.6))}
  }};
 }
 return {arm,mouth,mouthBase,expressionMouth,visemes};
});
