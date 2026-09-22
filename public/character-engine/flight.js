/* Independent bounded flight: one clock, continuous position/velocity on retarget. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CharacterFlight=factory();})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 function createFlight(){
  const s={x:.5,y:.62,vx:0,vy:0,bank:0,lift:1,moving:false,landed:false};
  let route=null,braking=false;
  function command(c){
   if(!c||!['move','hover','land'].includes(c.action))return false;
   if(c.action==='hover'){route=null;braking=true;s.moving=true;return true;}
   if(!Number.isFinite(c.speed)||c.speed<.1||c.speed>1||!['direct','arc','swoop'].includes(c.path))return false;
   if(!Number.isFinite(c.x)||c.x<0||c.x>1||!Number.isFinite(c.y)||c.y<0||c.y>1)return false;
   const end={x:c.x,y:c.action==='land'?1:c.y},d=Math.hypot(end.x-s.x,end.y-s.y);
   const mid={x:(s.x+end.x)/2,y:clamp((s.y+end.y)/2+(c.path==='arc'?-.38:c.path==='swoop'?.38:0))};
   const length=Math.hypot(mid.x-s.x,mid.y-s.y)+Math.hypot(end.x-mid.x,end.y-mid.y);
   route={start:{x:s.x,y:s.y},mid,end,t:0,duration:Math.max(.65,length/(.08+c.speed*.3)),speed:.08+c.speed*.3,land:c.action==='land'};
   braking=false;s.moving=true;if(!route.land||d>.002)s.landed=false;return true;
  }
  function step(dt,reduced=false){
   if(!Number.isFinite(dt)||dt<=0)return {...s};
   // Substeps keep acceleration stable on slow displays; a hidden tab does not teleport.
   let remaining=Math.min(dt,.1);
   while(remaining>1e-7){
    const h=Math.min(remaining,1/120);remaining-=h;
    if(route){
     route.t=Math.min(1,route.t+h/route.duration);
     const t=route.t*route.t*(3-2*route.t),u=1-t;
     const target={x:u*u*route.start.x+2*u*t*route.mid.x+t*t*route.end.x,y:u*u*route.start.y+2*u*t*route.mid.y+t*t*route.end.y};
     const previousSpeed=Math.hypot(s.vx,s.vy);
     const acceleration={x:(target.x-s.x)*36-12*s.vx,y:(target.y-s.y)*36-12*s.vy};
     const magnitude=Math.hypot(acceleration.x,acceleration.y),scale=Math.min(1,.9/Math.max(magnitude,1e-9));
     s.vx+=acceleration.x*scale*h;s.vy+=acceleration.y*scale*h;
     const v=Math.hypot(s.vx,s.vy),limit=Math.max(route.speed*(reduced?.65:1),previousSpeed-.8*h);
     if(v>limit){s.vx*=limit/v;s.vy*=limit/v;}
     if(route.t===1&&Math.hypot(s.x-route.end.x,s.y-route.end.y)<.001&&v<.004){s.landed=route.land;route=null;braking=true;}
    }else{const decay=Math.exp(-h*9);s.vx*=decay;s.vy*=decay;}
    for(const a of ['x','y']){
     // Predictive braking before the boundary, including rapid direction changes.
     const v='v'+a,bound=s[v]>0?1-s[a]:s[a];
     s[v]=Math.sign(s[v])*Math.min(Math.abs(s[v]),Math.sqrt(2*.9*Math.max(0,bound)),Math.max(0,bound)/h);
     s[a]=clamp(s[a]+s[v]*h);
    }
    if(braking&&Math.hypot(s.vx,s.vy)<.001){s.moving=false;braking=false;}
    const bank=reduced?0:clamp(s.vx*55,-12,12);
    s.bank+=(bank-s.bank)*(1-Math.exp(-h*7));
    s.lift+=((s.landed?0:1)-s.lift)*(1-Math.exp(-h*5));
   }
   return {...s};
  }
  return {command,step,state:()=>({...s})};
 }
 return {createFlight};
});
