/* Human family: one editable vector anatomy, four data-driven wardrobes. */
(function(host){
 'use strict';
 const presets={
  hakim:{name:'حكيم',skin:'#EDAE88',hair:'#99918E',coat:'#7E9586',pants:'#A58D7B',shirt:'#F9F3E8',knit:'#C5AD90',shoe:'#725246',eyes:'#645348',hairStyle:'swept',beard:true,glasses:true,female:false},
  reem:{name:'ريم',skin:'#F7BC9D',hair:'#805C50',coat:'#D8A3AF',pants:'#D8C5A8',shirt:'#FFF9EF',knit:'#FFF9EF',shoe:'#FCF5ED',eyes:'#845E47',hairStyle:'long',outfit:'cardigan',beard:false,glasses:false,female:true},
  marwan:{name:'مروان',skin:'#EAA57A',hair:'#4B4140',coat:'#9A8570',pants:'#746056',shirt:'#FFF9F1',knit:'#C3A98C',shoe:'#6D4D40',eyes:'#6E4936',hairStyle:'curly',vestButtons:true,beard:true,glasses:false,female:false},
  amal:{name:'أمل',skin:'#F4B494',hair:'#614A4C',coat:'#AE96CD',pants:'#F2E2D4',shirt:'#FFFAF4',knit:'#FFFAF4',shoe:'#554653',eyes:'#64483E',hairStyle:'bob',beard:false,glasses:false,female:true,headset:true}
 };
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
 const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
 const line=(d,stroke,width=1.5,extra='')=>path(d,'none',`stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}`);
 const gradient=(id,color,dark=.25)=>`<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="80%"><stop stop-color="${mix(color,'#FFFFFF',.25)}"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="${mix(color,'#342A34',dark)}"/></linearGradient>`;
 function hairBack(p){
  if(p.hairStyle==='long')return path('M237 90 C228 57 273 37 311 45 C362 42 380 91 379 143 C382 186 395 208 382 229 C411 256 386 279 394 297 C375 303 372 284 368 280 Q375 312 346 303 L245 299 Q216 310 219 282 C197 282 204 262 210 251 Q194 225 212 204 C218 176 212 124 237 90Z','url(#h-hair)')+line('M229 145 C207 189 244 203 222 231 S241 267 229 287 M369 149 C392 199 355 212 378 235 S360 272 377 291','#B08778',3,'opacity=".35"');
  if(p.hairStyle==='bob')return path('M232 98 Q219 45 280 41 C316 22 329 51 331 53 C375 48 385 99 378 150 C399 194 368 232 344 226 Q325 241 307 221 Q281 237 263 222 C233 238 205 206 221 169Z','url(#h-hair)')+line('M233 133 Q213 197 247 214 M366 138 Q388 193 352 216','#AA8584',3,'opacity=".35"');
  return path('M229 129 C214 84 232 55 261 51 Q313 19 350 59 C379 69 383 108 369 143 L358 178 H241Z','url(#h-hair)');
 }
 function hairFront(p){
  if(p.hairStyle==='curly'){
   let curls='';for(let row=0;row<3;row++)for(let i=0;i<8-row;i++){const x=232+i*18+row*7,y=92-row*15-Math.sin(i*.5)*9;curls+=`<ellipse cx="${x}" cy="${y}" rx="12" ry="14" transform="rotate(${(i%3-1)*25} ${x} ${y})" fill="url(#h-curl)"/>`;}
   return `<g>${curls}</g>`+path('M231 106 Q235 89 244 100 L238 143 Q224 133 231 106 M361 99 Q374 100 369 123 L364 143Z','url(#h-hair)');
  }
  const swept=path('M229 129 Q210 100 235 86 Q222 60 263 57 C285 29 322 33 333 57 C356 46 379 79 369 119 L358 100 Q351 75 328 83 Q302 93 280 80 Q247 87 239 125 L240 147Z','url(#h-hair)')+line('M235 94 C267 88 268 48 301 49 M247 98 C281 89 282 62 308 57 M267 80 Q301 44 325 63 M341 64 Q365 75 366 97',mix(p.hair,'#FFFFFF',.55),3,'opacity=".4"')+line('M242 111 Q251 94 268 89 M303 78 Q329 73 323 54',mix(p.hair,'#342A34',.35),2,'opacity=".4"');
  if(p.hairStyle==='swept')return swept;
  return path('M226 146 C218 115 234 72 256 59 C280 38 315 34 321 65 Q340 43 359 69 C375 89 362 100 391 133 Q373 134 352 116 Q328 101 322 82 C302 72 280 94 267 117 Q249 141 222 150Z','url(#h-hair)')+path('M228 137 C212 164 218 190 238 200 Q226 179 244 153 Q265 130 281 110 Q253 137 228 137Z','url(#h-hair)')+line('M231 136 C274 110 267 64 303 55 M251 125 Q283 102 287 77 M334 72 Q342 107 373 122',mix(p.hair,'#FFFFFF',.42),2.8,'opacity=".4"');
 }
 function eye(side,p){const x=side==='l'?272:329;return `<g id="h-eye-${side}" transform="translate(${x} 142)">
 <path id="h-eye-white-${side}" d="M-18 0 C-18-30 18-30 18 0 C18 23-18 23-18 0Z" fill="#FFFBF4"/>
 <g clip-path="url(#h-eye-clip-${side})"><g id="h-pupil-${side}"><ellipse cx="1" cy="0" rx="12.7" ry="17.8" fill="url(#h-iris)"/><ellipse cx="1" cy="0" rx="8.1" ry="12.8" fill="#302627"/><ellipse cx="-3.5" cy="-7" rx="4" ry="5" fill="#fff"/><circle cx="7.5" cy="7" r="1.9" fill="#fff4dc"/></g></g>
 <path id="h-lid-${side}" d="M-18 0 C-18-30 18-30 18 0" fill="none" stroke="${mix(p.hair,'#302128',.45)}" stroke-width="${p.female?3.2:2.1}" stroke-linecap="round"/>
 <path id="h-eye-closed-${side}" d="M-17 0 Q0 -9 17 0" fill="none" stroke="${p.hair}" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
 ${p.female?line(side==='l'?'M-16 -9 l-5 -4 M-13 -16 l-5 -5':'M16 -9 l5 -4 M13 -16 l5 -5',p.hair,2.5,`id="h-lashes-${side}"`):''}</g>`;}
 function head(p){
  const beard=p.beard?path('M239 172 C244 181 249 187 257 188 Q265 171 286 176 Q302 181 319 175 Q340 172 344 188 L363 166 C365 202 347 228 320 236 Q297 244 271 231 C246 222 235 203 239 172Z','url(#h-hair)')+path('M273 194 Q300 186 329 195 C330 214 316 226 301 225 Q276 224 273 194Z','url(#h-skin)')+line('M246 191 Q251 215 267 221 M254 194 Q260 217 273 224 M337 195 Q342 210 326 226 M280 223 Q293 236 313 229',mix(p.hair,'#FFFFFF',.42),2,'opacity=".23"'):'';
  return `<g id="h-head">
 <g fill="url(#h-skin)"><ellipse cx="234" cy="165" rx="14" ry="22" transform="rotate(-15 234 165)"/><ellipse cx="368" cy="165" rx="14" ry="22" transform="rotate(15 368 165)"/></g>
 ${line('M235 177 Q224 160 235 154 M367 177 Q379 160 367 154',mix(p.skin,'#A6544A',.4),3,'opacity=".55"')}
 ${path('M237 119 C236 88 260 70 300 71 C342 69 366 90 364 122 L364 171 C365 209 339 232 302 234 C263 234 239 209 237 174Z','url(#h-skin)')}
 <ellipse cx="279" cy="110" rx="42" ry="31" fill="url(#h-face-light)"/>
 ${beard}
 <g id="h-blush" opacity=".7"><ellipse cx="253" cy="173" rx="18" ry="12" fill="url(#h-blush-gradient)"/><ellipse cx="349" cy="173" rx="18" ry="12" fill="url(#h-blush-gradient)"/></g>
 ${eye('l',p)}${eye('r',p)}
 ${line('M256 110 Q270 99 284 106',p.hair,p.female?5:7,'id="h-brow-l"')}${line('M316 106 Q331 100 344 110',p.hair,p.female?5:7,'id="h-brow-r"')}
 ${path('M297 153 C296 162 290 170 296 175 Q303 179 310 174 Q313 170 305 161Z','url(#h-nose)')}${line('M298 173 Q303 176 307 173','#C38168',1,'opacity=".5"')}
 <g id="mouth" transform="translate(302 195) scale(.8)"><path id="mouth-fill" fill="#673934" d="M-23 0 Q0 9 23 0 Q0 34-23 0Z"/><g clip-path="url(#h-mouth-clip)"><path id="teeth" fill="#FFFCF2" d="M-21 0 H21 L18 7 Q0 10-18 7Z"/><path id="lower-teeth" fill="#F8EADF" opacity="0"/><ellipse id="tongue" cx="0" cy="18" rx="13" ry="6" fill="#DE8583"/></g><path id="mouth-edge" d="M-23 0 Q0 9 23 0" fill="none" stroke="#AD615B" stroke-width="2" stroke-linecap="round"/></g>
 ${p.beard?path('M269 188 Q274 175 291 181 Q302 184 313 180 Q331 174 335 188 Q325 197 303 187 Q286 198 269 188Z','url(#h-hair)'):''}
 <g id="h-tears" opacity="0" fill="#B5DCF0"><path d="M253 164 Q244 181 254 186 Q265 182 253 164Z"/><path d="M349 164 Q340 181 350 186 Q361 182 349 164Z"/></g>
 ${hairFront(p)}
 ${p.glasses?`<g fill="none" stroke="#494644" stroke-width="3.2"><circle cx="272" cy="144" r="26"/><circle cx="329" cy="144" r="26"/><path d="M298 141 Q302 136 304 141 M246 139 L236 136 M355 139 L366 134"/><path d="M252 132 Q260 119 275 122 M311 131 Q319 119 332 122" stroke="#FFF9F3" stroke-width="2" opacity=".55"/></g>`:''}
 ${p.headset?`<g fill="none" stroke="#77717D" stroke-width="3"><ellipse cx="239" cy="192" rx="5" ry="9"/><ellipse cx="366" cy="192" rx="5" ry="9"/><path d="M370 143 Q379 170 360 184 L341 191"/><ellipse cx="337" cy="192" rx="7" ry="4" fill="#716A79"/></g>`:''}</g>`;
 }
 function wardrobe(p){const cardigan=p.outfit==='cardigan';return `
 <g id="h-body">
 ${path(p.female?'M253 369 L301 371 L298 458 L289 551 Q266 562 239 549 L249 449Z':'M253 369 L301 371 L299 457 L284 548 Q268 557 247 550 L254 447Z','url(#h-pants)')}
 ${path(p.female?'M301 371 L349 369 L360 449 L374 550 Q346 562 318 551 L304 455Z':'M301 371 L349 369 L353 449 L363 550 Q343 559 322 550 L305 455Z','url(#h-pants)')}
 ${line('M271 397 L266 530 M331 398 L344 534',mix(p.pants,'#635449',.28),1.3,'opacity=".35"')}
 ${path('M248 542 Q267 546 283 542 L286 565 Q278 581 239 576 Q232 574 237 563Z','url(#h-shoes)')}
 ${path('M323 543 Q341 548 360 543 Q363 556 377 563 Q392 575 374 578 L328 577 Q319 575 323 543Z','url(#h-shoes)')}
 ${line('M239 575 Q262 580 284 571 M326 575 Q361 581 382 574',mix(p.shoe,'#251F24',.35),3)}
 ${line('M249 555 L273 555 M249 560 L272 560 M332 555 L353 557 M333 560 L359 562',mix(p.shoe,p.shirt,.35),1.8)}
 ${path('M278 221 L324 221 L326 249 Q317 264 302 268 Q281 259 276 249Z','url(#h-skin)')}
 ${path('M278 239 Q301 256 326 239 L350 266 L342 386 L259 386 L254 267Z','url(#h-shirt)')}
 ${!p.female?path('M271 270 L301 295 L332 270 L339 380 Q302 392 264 380Z','url(#h-knit)')+line('M281 279 L302 304 L324 279',mix(p.knit,'#FFFFFF',.35),3)+path('M277 238 L300 263 L287 280 L269 253 M325 238 L302 263 L316 280 L334 253','url(#h-shirt)'):path('M279 243 Q302 263 326 243 L331 255 Q301 275 272 255Z','url(#h-shirt)')}
 ${p.vestButtons?line('M302 304 L302 374',mix(p.knit,'#665345',.3),1.2)+[316,337,358].map(y=>`<circle cx="302" cy="${y}" r="2.8" fill="#97755B"/>`).join(''):''}
 ${path(`M277 242 Q253 244 241 261 L243 320 L232 399 Q256 414 278 400 L291 302Z`,'url(#h-coat)')}
 ${path('M326 242 Q352 247 363 261 L361 320 L372 399 Q350 413 327 400 L313 302Z','url(#h-coat)')}
 ${cardigan?line('M277 249 Q286 316 274 400 M327 249 Q316 326 331 400',mix(p.coat,'#FFF1E5',.27),7):path('M271 245 L258 268 L269 278 L259 287 L284 323 L292 295Z','url(#h-lapel)')+path('M331 245 L344 268 L333 278 L343 287 L318 323 L312 295Z','url(#h-lapel)')}
 ${line('M244 354 L270 359 L266 381 Q250 383 241 375Z',mix(p.coat,'#453845',.25),1.3,'opacity=".7"')}${line('M334 359 L359 354 L363 374 Q348 385 336 381Z',mix(p.coat,'#453845',.25),1.3,'opacity=".7"')}
 ${[342,372,398].slice(0,cardigan?3:2).map(y=>`<circle cx="${cardigan?325:319}" cy="${y}" r="3.3" fill="${mix(p.coat,'#655344',.35)}" stroke="${mix(p.coat,'#FFFFFF',.2)}" stroke-width="1"/>`).join('')}
 ${p.headset?`<path d="M278 370 H323 V377 H278Z" fill="#61505A"/><rect x="297" y="368" width="12" height="11" rx="1" fill="none" stroke="#C5A77E" stroke-width="2"/>`:''}
 </g>`;}
 function hand(side,p){return `<g id="h-hand-${side}"><g transform="${side==='l'?'scale(-1 1)':''}">
 <path id="h-palm-${side}" d="M-8 0 Q-12-16-5-21 Q2-29 10-24 Q22-22 16-3 Q8 4-8 0Z" fill="url(#h-skin)"/>
 ${line('M-4 -12 Q3 -9 7 -5 M1 -19 L2 -14 M7 -19 L7 -14 M12 -17 L12 -12',mix(p.skin,'#AA6353',.35),.85,`id="h-fingers-${side}" opacity=".24"`)}
 </g></g>`;}
 function arms(p){return ['l','r'].map(side=>`<g id="h-arm-${side}"><path id="h-sleeve-${side}" fill="url(#h-coat)" stroke="${mix(p.coat,'#423742',.14)}" stroke-width=".6"/><path id="h-sleeve-light-${side}" fill="none" stroke="${mix(p.coat,'#FFFFFF',.28)}" stroke-width="2" opacity=".45"/><path id="h-cuff-${side}" fill="url(#h-shirt)"/>${hand(side,p)}</g>`).join('');}
 function render(id,{portrait=false,prefix=''}={}){
  if(!Object.hasOwn(presets,id))throw new Error('Unknown human preset');if(prefix&&!/^[a-zA-Z][\w-]*$/.test(prefix))throw new Error('Invalid SVG prefix');const p=presets[id];
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'211 34 180 212':'100 0 400 610'}" role="img" aria-labelledby="h-title"><title id="h-title">${escape(p.name)}</title><defs>
 ${gradient('h-coat',p.coat,.3)}${gradient('h-lapel',mix(p.coat,'#FFFFFF',.08),.22)}${gradient('h-pants',p.pants,.16)}${gradient('h-shirt',p.shirt,.08)}${gradient('h-knit',p.knit,.15)}${gradient('h-hair',p.hair,.4)}${gradient('h-shoes',p.shoe,.3)}${gradient('h-iris',p.eyes,.5)}
 <radialGradient id="h-skin" cx=".38" cy=".25" r=".8"><stop stop-color="${mix(p.skin,'#FFF5DC',.6)}"/><stop offset=".58" stop-color="${p.skin}"/><stop offset="1" stop-color="${mix(p.skin,'#AE6559',.23)}"/></radialGradient>
 <radialGradient id="h-curl" cx=".32" cy=".2" r=".8"><stop stop-color="${mix(p.hair,'#D8C5B5',.24)}"/><stop offset=".5" stop-color="${p.hair}"/><stop offset="1" stop-color="${mix(p.hair,'#221F27',.48)}"/></radialGradient>
 <radialGradient id="h-face-light"><stop stop-color="#FFF7E9" stop-opacity=".3"/><stop offset="1" stop-color="#FFF7E9" stop-opacity="0"/></radialGradient>
 <radialGradient id="h-blush-gradient"><stop stop-color="#EC8D82" stop-opacity=".65"/><stop offset="1" stop-color="#EF9F8A" stop-opacity="0"/></radialGradient>
 <radialGradient id="h-nose" cx=".35" cy=".2"><stop stop-color="${mix(p.skin,'#FFF4DD',.4)}"/><stop offset="1" stop-color="${mix(p.skin,'#D3846E',.4)}"/></radialGradient>
 <radialGradient id="h-shadow-paint"><stop stop-color="#6D5C4C" stop-opacity=".22"/><stop offset="1" stop-color="#6D5C4C" stop-opacity="0"/></radialGradient>
 <clipPath id="h-mouth-clip"><path id="mouth-cut" d="M-23 0 Q0 9 23 0 Q0 34-23 0Z"/></clipPath>
 ${['l','r'].map(side=>`<clipPath id="h-eye-clip-${side}"><path id="h-eye-cut-${side}" d="M-18 0 C-18-30 18-30 18 0 C18 23-18 23-18 0Z"/></clipPath>`).join('')}</defs>
 <ellipse id="h-shadow" cx="304" cy="579" rx="104" ry="15" fill="url(#h-shadow-paint)"/>
 <g id="h-character"><g id="h-hair-back">${hairBack(p)}</g>${wardrobe(p)}${head(p)}${arms(p)}</g></svg>`;
  if(prefix)svg=svg.replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix+id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix+id})`).replace('aria-labelledby="h-title"',`aria-labelledby="${prefix}h-title"`);
  return svg;
 }
 host.HumanArt={render,presets};
})(typeof window!=='undefined'?window:this);
