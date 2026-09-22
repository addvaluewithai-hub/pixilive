/* Character Lab engine. Pure recipe -> geometry plan -> editable SVG.
   Browser: CharacterEngine.createEngine(svgString).
   Node: require('./engine.js').createEngine(svgString). No dependencies. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.js'));else root.CharacterEngine=factory(root.CharacterGeometry);})(typeof window!=='undefined'?window:this,function(Geometry){
 'use strict';
 const DEFAULTS={
  sprite:{name:'لومي',species:'sprite',fur:'#F4E8F5',cream:'#FFF8F0',accent:'#A080E8',eyes:'#8A60D2',head:96,body:90,ears:100,eyeSize:114,accessory:'none'},
  fox:{name:'إمبر',species:'fox',fur:'#F58A35',cream:'#FFF2DA',accent:'#519B8C',eyes:'#AF7337',head:100,body:100,ears:100,eyeSize:100,accessory:'scarf'},
  cat:{name:'لوز',species:'cat',fur:'#8EABC1',cream:'#F0F2E9',accent:'#C67B78',eyes:'#71915C',head:98,body:96,ears:100,eyeSize:97,accessory:'bow'},
  rabbit:{name:'سكّر',species:'rabbit',fur:'#E9CFC0',cream:'#FFF7EF',accent:'#A18FBE',eyes:'#8C6663',head:94,body:94,ears:100,eyeSize:104,accessory:'scarf'},
  bear:{name:'بندق',species:'bear',fur:'#AF8057',cream:'#EAD1AE',accent:'#769658',eyes:'#745337',head:103,body:114,ears:100,eyeSize:95,accessory:'scarf'}
 };
 const PALETTES=[['#F58A35','#FFF2DA','#519B8C','#AF7337'],['#8EABC1','#F0F2E9','#C67B78','#71915C'],['#E9CFC0','#FFF7EF','#A18FBE','#8C6663'],['#AF8057','#EAD1AE','#769658','#745337'],['#D69273','#FFF0D5','#597E9B','#698859'],['#8A839B','#E8E1E9','#D49B64','#AD784B'],['#D6BC7C','#FFF2D4','#709989','#7D7254'],['#D4D7D3','#FFF9F0','#A27168','#699AA3']];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const round=x=>+x.toFixed(3);
 function hex(s){if(typeof s!=='string'||!/^#[0-9a-fA-F]{6}$/.test(s))throw new Error('لون غير صالح. استخدم صيغة #RRGGBB.');return s.toUpperCase();}
 function mix(a,b,t){const aa=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),bb=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));return '#'+aa.map((v,i)=>Math.round(v+(bb[i]-v)*t).toString(16).padStart(2,'0')).join('');}
 function normalize(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('الوصفة لازم تكون JSON object.');
  if(input.version!==undefined&&input.version!==1)throw new Error('إصدار الوصفة غير مدعوم.');
  const species=input.species??'fox';if(!Object.hasOwn(DEFAULTS,species))throw new Error('اختار ثعلب أو قطة أو أرنب أو دب.');
  const out={version:1,...DEFAULTS[species]};
  if(input.name!==undefined){if(typeof input.name!=='string')throw new Error('الاسم لازم يكون نص.');out.name=input.name.trim().slice(0,40)||DEFAULTS[species].name;}
  for(const key of ['fur','cream','accent','eyes'])if(input[key]!==undefined)out[key]=hex(input[key]);
  for(const [key,min,max] of [['head',90,110],['body',88,118],['ears',80,112],['eyeSize',85,115]]){
   if(input[key]!==undefined){if(typeof input[key]!=='number'||!Number.isFinite(input[key]))throw new Error('قيمة '+key+' غير صالحة.');out[key]=round(clamp(input[key],min,max));}
  }
  if(input.accessory!==undefined){if(!['scarf','bow','none'].includes(input.accessory))throw new Error('الإكسسوار غير مدعوم.');out.accessory=input.accessory;}
  return out;
 }
 function random(seed=1,species='fox'){
  let n=Number(seed)>>>0;const rng=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const p=PALETTES[Math.floor(rng()*PALETTES.length)];
  return normalize({...DEFAULTS[species],fur:p[0],cream:p[1],accent:p[2],eyes:p[3],head:Math.round(94+rng()*13),body:Math.round(92+rng()*22),ears:Math.round(88+rng()*21),eyeSize:Math.round(92+rng()*17),accessory:['scarf','bow','none'][Math.floor(rng()*3)]});
 }
 const shapes={
  cat:{head:'M182 216 C180 174 218 141 266 141 Q301 131 337 142 C386 139 425 171 425 216 Q427 245 441 260 L451 267 Q444 272 437 274 L443 286 Q433 288 426 285 C407 323 363 342 303 344 C243 345 202 326 180 295 L165 298 L171 284 L157 280 Q166 274 172 267 Q180 249 182 216Z',
   cheek:'M178 280 C209 260 244 280 270 293 Q302 307 334 293 C361 280 397 259 430 281 Q412 326 355 339 Q300 353 244 337 Q198 322 178 280Z',
   left:['M187 189 Q172 141 188 100 Q193 91 202 101 Q239 126 255 170Z','M193 178 Q184 139 194 111 Q222 130 244 166Z','M203 171 Q194 144 199 126 Q218 141 231 165Z','M204 172 L211 159 L218 167 L224 159 L238 174Z'],
   tail:['M345 407 C387 427 432 420 455 389 C473 365 472 353 457 341 C445 331 448 315 459 311 C474 306 489 320 496 338 C513 380 483 421 450 437 C416 455 376 453 345 433Z','','M469 357 Q484 367 505 365 L503 378 Q485 380 468 369Z','M451 393 Q463 405 486 408 L478 420 Q456 413 443 403Z','M402 421 Q414 434 415 456 L399 455 Q399 439 387 426Z']},
  rabbit:{head:'M184 221 C185 170 229 140 275 143 Q302 131 329 143 C382 138 422 174 423 223 C425 247 435 267 434 280 C432 322 379 345 304 346 C232 346 180 324 174 286 Q170 268 179 253 Q184 240 184 221Z',
   cheek:'M179 282 C196 260 229 266 256 283 Q280 302 302 301 Q325 301 350 282 C380 265 413 263 431 282 Q432 322 378 343 Q301 358 229 334 Q185 314 179 282Z',
   left:['M191 181 C176 133 166 73 175 28 C177 8 190 0 203 11 C227 33 245 116 246 165Z','M198 175 C183 129 175 68 182 31 C185 17 190 16 197 25 C215 50 230 115 234 165Z','M204 166 C191 115 184 62 190 39 C196 18 213 90 224 160Z','M196 179 Q214 157 240 173Z'],
   tail:['M363 416 C365 393 391 383 412 397 C435 411 435 438 416 452 C394 465 368 449 363 429Z','M376 404 Q397 389 414 407 Q424 417 420 429 Q409 410 391 411Z','','','']},
  bear:{head:'M179 226 C171 173 221 133 273 138 Q304 134 333 138 C390 132 433 174 428 228 C434 263 431 285 418 306 C393 340 351 350 303 350 C250 350 205 336 186 309 C172 289 172 256 179 226Z',
   cheek:'M229 281 C224 249 259 240 280 262 Q302 275 324 262 C350 240 382 254 378 283 C379 319 349 340 303 340 C259 340 227 318 229 281Z',
   left:['M166 154 C147 133 155 102 179 92 C202 82 230 94 235 119 C241 144 223 167 199 173Z','M175 150 C157 135 164 109 185 103 C206 98 226 111 225 133 Q220 160 195 162Z','M177 144 C166 133 172 115 187 111 C204 107 220 121 214 136 Q210 152 191 155Z',''],
   tail:['M371 410 C378 393 401 394 411 410 C420 427 405 444 389 441 C374 440 366 425 371 410Z','','','','']}
 };
 function mirrorPath(d){return d;} // The right ear is mirrored as a component, not rewritten numerically.
 function createEngine(master){
  if(typeof master!=='string'||!master.includes('id="head-scale"'))throw new Error('Invalid character master.');
  const original={};for(const m of master.matchAll(/<([\w:-]+)\b([^<>]*)>/g)){const id=/\bid="([^"]+)"/.exec(m[2])?.[1];if(id){const attrs={};for(const a of m[2].matchAll(/([\w:-]+)="([^"]*)"/g))attrs[a[1]]=a[2];original[id]=attrs;}}
  function plan(raw){
   const r=normalize(raw),p={};const put=(id,attrs)=>{if(!original[id])throw new Error('Missing semantic part: '+id);p[id]={...(p[id]||{}),...attrs};};
   const setD=(id,d)=>put(id,{d});
   const grad=(name,colors)=>colors.forEach((c,i)=>put(name+'-stop-'+i,{'stop-color':c}));
   const fur=r.fur,cream=r.cream,accent=r.accent,ink=mix(fur,'#30252B',.69);
   grad('fur',[mix(fur,'#FFF2CE',.57),mix(fur,'#FFD499',.2),fur,mix(fur,'#62392F',.4)]);
   grad('head-fur',[mix(fur,'#FFF2CE',.65),mix(fur,'#FFE3AB',.31),fur,mix(fur,'#9A422B',.16),mix(fur,'#4B2B2C',.38)]);
   grad('ivory',[mix(cream,'#FFFFFF',.65),cream,mix(cream,fur,.15),mix(cream,ink,.28)]);
   grad('muzzle',[mix(cream,'#FFFFFF',.76),mix(cream,'#FFFFFF',.25),mix(cream,fur,.14)]);
   grad('tail-fur',[mix(fur,'#FFEBC3',.48),mix(fur,'#FFCD9F',.15),fur,mix(fur,'#59312D',.44)]);
   grad('ear-dark',[mix(fur,'#4E3436',.58),mix(fur,'#392C34',.73)]);
   grad('ear-inner',[mix(fur,'#F6C4BA',.77),mix(fur,'#BD777A',.7),mix(fur,'#603F4B',.58)]);
   const paws=r.species==='sprite'?mix(fur,cream,.5):r.species==='fox'?mix(fur,'#44302C',.73):mix(fur,'#533B3B',r.species==='rabbit'?.08:.3);
   grad('paw-fur',[mix(paws,cream,.4),paws,mix(paws,'#3B2C32',.22)]);
   grad('leg-fur',[mix(fur,cream,.25),fur,mix(fur,paws,.55),paws]);
   const arm=[mix(fur,ink,.12),mix(fur,cream,.25),mix(fur,ink,.06)];
   grad('arm-fur',arm);grad('arm-fur-l',arm);grad('arm-fur-r',arm);
   for(const side of ['l','r']){
    // Match the opaque shoulder to the torso lighting, rather than hiding it.
    const t=Math.hypot(((side==='l'?-52:52)+70)/140-.33,(367-326)/137-.2)/.86;
    const stops=[mix(fur,'#FFF2CE',.57),mix(fur,'#FFD499',.2),fur,mix(fur,'#62392F',.4)],offsets=[0,.36,.7,1];
    const j=t<.36?0:t<.7?1:2,shoulder=mix(stops[j],stops[j+1],clamp((t-offsets[j])/(offsets[j+1]-offsets[j]),0,1));
    grad('arm-skin-'+side,[shoulder,mix(shoulder,fur,.3),mix(fur,paws,.18),mix(fur,paws,.64),paws]);put('palm-creases-'+side,{stroke:mix(paws,'#30282D',.32)});
   }
   grad('iris',[mix(r.eyes,'#F4D59B',.45),r.eyes,mix(r.eyes,'#342E31',.48),'#29252A']);
   grad('scarf',[mix(accent,'#F0F5DE',.4),accent,mix(accent,'#203B3A',.25),mix(accent,'#203B3A',.5)]);
   grad('scarf-edge',[mix(accent,'#F2F4D8',.57),mix(accent,'#D6E4CC',.15)]);
   grad('forehead-light',[mix(fur,cream,.68),mix(fur,cream,.68)]);
   for(const [id,a]of Object.entries(original))if(id.startsWith('scarf-detail-')){
    if(a.stroke?.startsWith('#'))put(id,{stroke:mix(accent,cream,.5)});
    if(a.fill?.startsWith('#'))put(id,{fill:mix(accent,cream,.25)});
   }
   const pink=['cat','rabbit'].includes(r.species);grad('nose-fur',pink?['#E5B1AA','#BB7E81','#905761']:['#79564A','#493331','#29242A']);
   for(const s of ['l','r']){
    put('brow-'+s,{stroke:mix(fur,ink,.65)});put('lid-'+s,{stroke:ink});put('closed-'+s,{stroke:ink});
    put('eye-rim-'+s,{fill:ink,stroke:mix(fur,ink,.4)});
    put('pupil-'+s+'-part-1',{rx:r.species==='cat'?8.5:11.8});
    put('ear-shape-'+s,{transform:`translate(${s==='l'?226:380} 181) scale(1 ${r.ears/100}) translate(${s==='l'?-226:-380} -181)`});
    put('leg-width-'+s,{transform:`translate(${round((r.body/100-1)*(s==='l'?-29:29))} 0)`});
   }
   put('head-scale',{transform:`translate(302 327) scale(${r.head/100}) translate(-302 -327)`});
   put('torso',{transform:`translate(302 357) scale(${r.body/100} 1) translate(-302 -357)`});
   put('scarf-front',{opacity:r.accessory==='scarf'?1:0});put('accessory-bow',{opacity:r.accessory==='bow'?1:0});
   const spacing=r.species==='bear'?49:r.species==='rabbit'?50:54,eyeY=r.species==='cat'?233:232;
   const eyeScale=r.eyeSize/100;
   put('eye-l',{transform:`translate(${302-spacing} ${eyeY}) scale(${eyeScale})`});put('eye-r',{transform:`translate(${302+spacing} ${eyeY}) scale(${eyeScale})`});
   put('whiskers',{opacity:r.species==='cat'?.8:r.species==='rabbit'?.38:0,stroke:mix(fur,ink,.43)});
   put('freckles',{opacity:r.species==='fox'?.6:r.species==='bear'?0:.25});
   put('cheek-streak',{opacity:r.species==='bear'?0:.55});put('forehead-streak',{stroke:mix(fur,cream,.65),opacity:r.species==='bear'?.15:.25});
   const spec=shapes[r.species];
   setD('head-silhouette',spec?spec.head:original['head-silhouette'].d);
   setD('cheek-patch',spec?spec.cheek:original['cheek-patch'].d);
   for(let i=0;i<5;i++)setD('tail-part-'+i,spec?spec.tail[i]:original['tail-part-'+i].d);
   for(let i=0;i<4;i++){
    setD('ear-l-part-'+i,spec?spec.left[i]:original['ear-l-part-'+i].d);
    setD('ear-r-part-'+i,spec?mirrorPath(spec.left[i]):original['ear-r-part-'+i].d);
    put('ear-r-part-'+i,{transform:spec?'translate(604 0) scale(-1 1)':''});
   }
   // Species-specific silhouettes retain the shared animation IDs.
   put('tail-part-1',{fill:r.species==='cat'?'url(#fur)':'url(#ivory)'});
   put('tail-part-0',{fill:r.species==='rabbit'?'url(#ivory)':'url(#tail-fur)'});
   for(let i=1;i<5;i++)put('tail-part-'+i,{opacity:r.species==='cat'?(i===1?.16:.2):original['tail-part-'+i].opacity??1});
   for(let i=2;i<5;i++)put('tail-part-'+i,{fill:r.species==='cat'?mix(fur,ink,.23):original['tail-part-'+i].fill??'none',stroke:r.species==='cat'?'none':original['tail-part-'+i].stroke??'none'});
   setD('muzzle-patch',r.species==='bear'?'M268 278 C269 263 287 262 302 273 C317 263 335 264 336 280 Q337 301 320 303 Q308 303 302 296 Q295 305 282 302 Q267 299 268 278Z':original['muzzle-patch'].d);
   setD('nose',r.species==='rabbit'?'M289 272 Q302 266 315 272 Q318 277 303 286 Q289 282 289 272Z':r.species==='cat'?'M288 271 Q303 267 317 272 Q316 280 303 287 Q290 281 288 271Z':r.species==='bear'?'M281 269 Q302 260 323 270 Q328 280 303 291 Q279 282 281 269Z':original.nose.d);
   put('nose-shine',{stroke:pink?'#FFD4C7':'#C39480',opacity:.57});
   setD('teeth',r.species==='rabbit'?'M-10 2 L10 2 L10 15 Q6 19 2 16 L0 10 L-2 16 Q-6 19-10 15Z':original.teeth.d);
   put('teeth',{transform:''});
   for(const side of ['l','r']){const x=302+((side==='l'?219:384)-302)*r.body/100;for(const [id,a]of Object.entries(Geometry.arm({side,x,y:414,body:r.body/100}).attributes))put(id,a);}
   for(const [id,a]of Object.entries(Geometry.mouth(Geometry.expressionMouth.happy,r.species).attributes))put(id,a);
   const flying=r.species==='sprite';
   for(const id of ['wings','sprite-tuft','sprite-star'])put(id,{opacity:flying?1:0});
   for(const id of ['ear-l','ear-r','tail','muzzle-patch'])put(id,{opacity:flying?0:1});
   grad('wing-glass',[mix(accent,'#FFF7FF',.68),accent,mix(accent,'#554394',.42)]);
   for(const side of ['l','r']){
    put('toe-lines-'+side,{opacity:flying?0:.48});
    const x=side==='l'?269:335;
    setD('sprite-foot-'+side,flying?`M${x-12} 460 Q${x+8} 452 ${x+13} 472 C${x+19} 487 ${x-2} 498 ${x-15} 485 Q${x-20} 475 ${x-12} 460Z`:original['sprite-foot-'+side].d);
   }
   if(flying){
    setD('head-silhouette','M180 235 C175 174 220 135 281 136 Q306 129 334 138 C392 141 427 181 424 237 C427 298 376 345 303 345 C230 345 178 302 180 235Z');
    put('cheek-patch',{opacity:0});put('cheek-streak',{opacity:0});put('freckles',{opacity:0});
    grad('head-fur',['#FFFCF6',mix(fur,'#FFFFFF',.6),fur,mix(fur,accent,.14),mix(fur,accent,.28)]);
    grad('nose-fur',['#F8D6DD','#EAB9C4','#CB8E9F']);
    setD('nose','M296 276 Q302 272 308 277 Q307 283 302 282 Q298 283 296 276Z');put('nose-shine',{opacity:0});
    for(const side of ['l','r'])put('palm-creases-'+side,{opacity:.18});
   }else{put('cheek-patch',{opacity:1});for(const side of ['l','r'])put('palm-creases-'+side,{opacity:original['palm-creases-'+side].opacity??1});}
   return {recipe:r,attributes:p};
  }
  function escape(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function render(raw,{prefix='',portrait=false}={}){
   const {recipe,attributes}=plan(raw);
   let svg=master.replace(/<([\w:-]+)\b([^<>]*)>/g,(whole,tag,a)=>{
    const id=/\bid="([^"]+)"/.exec(a)?.[1];if(!id||!attributes[id])return whole;
    for(const [key,value]of Object.entries(attributes[id])){const re=new RegExp('(?<=\\s)'+key+'="[^"]*"');if(re.test(a))a=a.replace(re,key+'="'+escape(value)+'"');else a=a.replace(/\/?$/,end=>' '+key+'="'+escape(value)+'"'+end);}
    return '<'+tag+a+'>';
   });
   svg=svg.replace(/(<title[^>]*>)[\s\S]*?(<\/title>)/,(_,a,b)=>a+escape(recipe.name)+b);
   if(portrait)svg=svg.replace('viewBox="0 -65 640 650"','viewBox="135 20 335 345"');
   if(prefix){if(!/^[a-zA-Z][\w-]*$/.test(prefix))throw new Error('Invalid prefix');svg=svg.replace(/\bid="([^"]+)"/g,(_,id)=>'id="'+prefix+id+'"').replace(/url\(#([^)]+)\)/g,(_,id)=>'url(#'+prefix+id+')').replace(/href="#([^"]+)"/g,(_,id)=>'href="#'+prefix+id+'"').replace(/aria-labelledby="([^"]+)"/g,(_,ids)=>'aria-labelledby="'+ids.split(' ').map(id=>prefix+id).join(' ')+'"');}
   return svg;
  }
  function apply(svg,raw){const {recipe,attributes}=plan(raw);for(const [id,attrs]of Object.entries(attributes)){const e=svg.querySelector('[id="'+id+'"]');if(!e)throw new Error('Missing part '+id);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);}svg.querySelector('[id="fox-title"]').textContent=recipe.name;return recipe;}
  return {normalize,random,plan,render,apply,presets:DEFAULTS,metrics:r=>{const n=normalize(r);return {head:n.head/100,body:n.body/100,eyes:n.eyeSize/100,species:n.species};}};
 }
 return {createEngine,normalize,random,presets:DEFAULTS};
});
