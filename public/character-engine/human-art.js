/* Human family: shared semantic rig, individually shaped faces and wardrobes. */
(function(host){
 'use strict';
 const presets={
  hakim:{name:'حكيم',skin:'#EDAE88',hair:'#97918B',coat:'#819888',pants:'#A38E79',shirt:'#FFF7E8',knit:'#CCB38F',shoe:'#745346',eyes:'#78614D',hairStyle:'swept',beard:true,glasses:true,female:false,
   anatomy:{headX:.94,headY:.91,eye:.82,eyeGap:29,shoulder:55,shoulderY:263,sleeve:18,hand:1,mouthY:199,mouthScale:.82,rest:{lx:232,ly:371,rx:372,ry:375,la:-169,ra:171,lo:.08,ro:.04}}},
  reem:{name:'ريم',skin:'#F7BC9D',hair:'#805C50',coat:'#D5A0AC',pants:'#D9C8AC',shirt:'#FFFAEE',knit:'#FFF9EF',shoe:'#FAF6EC',eyes:'#8C634B',hairStyle:'long',outfit:'cardigan',beard:false,glasses:false,female:true,
   anatomy:{headX:.92,headY:.96,eye:.86,eyeGap:27,shoulder:49,shoulderY:266,sleeve:17,hand:.95,mouthY:199,mouthScale:.78,rest:{lx:242,ly:371,rx:364,ry:368,la:-171,ra:165,lo:.1,ro:.08}}},
  marwan:{name:'مروان',skin:'#EAA57A',hair:'#4B403A',coat:'#9A856C',pants:'#746359',shirt:'#FFF9EE',knit:'#C3AB8D',shoe:'#705043',eyes:'#725139',hairStyle:'curly',vestButtons:true,beard:true,glasses:false,female:false,
   anatomy:{headX:1.02,headY:.92,eye:.85,eyeGap:30,shoulder:58,shoulderY:262,sleeve:19,hand:1.04,mouthY:200,mouthScale:.84,rest:{lx:226,ly:369,rx:376,ry:373,la:-167,ra:169,lo:.08,ro:.06}}},
  amal:{name:'أمل',skin:'#F4B494',hair:'#614A4C',coat:'#AB95C6',pants:'#F0E3D2',shirt:'#FFFAF0',knit:'#FFFAF4',shoe:'#5C4A57',eyes:'#73544A',hairStyle:'bob',beard:false,glasses:false,female:true,headset:true,
   anatomy:{headX:.92,headY:.89,eye:.79,eyeGap:28,shoulder:51,shoulderY:262,sleeve:16.8,hand:.96,mouthY:197,mouthScale:.79,rest:{lx:238,ly:366,rx:368,ry:372,la:-167,ra:172,lo:.1,ro:.05}}}
 };
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
 const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
 const line=(d,stroke,width=1.5,extra='')=>path(d,'none',`stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}`);
 const gradient=(id,color,dark=.25)=>`<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="80%"><stop stop-color="${mix(color,'#FFFFFF',.3)}"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="${mix(color,'#342A34',dark)}"/></linearGradient>`;
 const headTransform=p=>`translate(301 232) scale(${p.anatomy.headX} ${p.anatomy.headY}) translate(-301 -232)`;
 function hairBack(p){
  if(p.hairStyle==='long')return path('M237 96 C231 56 267 42 301 45 C349 38 378 71 376 124 C375 157 382 179 381 201 C378 218 389 231 384 246 C379 260 383 276 371 285 Q359 292 350 281 L250 285 Q224 291 217 272 C224 257 213 246 217 229 C230 202 214 182 224 152Z','url(#h-hair)')+path('M235 130 C219 180 246 193 230 220 C218 244 242 255 233 277 Q247 276 246 265 C253 246 236 236 246 217 C261 190 238 166 249 140Z','url(#h-hair-light)')+line('M366 145 C377 177 359 190 370 213 C381 237 359 253 369 273',mix(p.hair,'#DDB696',.3),2,'opacity=".4"');
  if(p.hairStyle==='bob')return path('M234 109 C225 75 240 48 278 44 C309 31 342 44 359 62 C383 91 376 123 377 155 C377 193 368 215 346 224 Q325 230 313 222 Q298 229 279 223 C250 234 224 215 223 181 Q220 140 234 109Z','url(#h-hair)')+path('M229 144 Q222 190 243 208 Q254 218 270 215 C248 201 250 172 249 149Z','url(#h-hair-light)')+line('M361 138 Q376 184 353 210',mix(p.hair,'#E2BBAB',.35),2,'opacity=".45"');
  return path('M236 145 Q221 115 230 87 C240 54 270 49 303 49 C349 47 377 75 373 118 L361 166 L245 170Z','url(#h-hair)');
 }
 function hairFront(p){
  if(p.hairStyle==='curly')return path('M231 123 Q221 111 226 99 Q216 85 231 78 Q230 62 245 63 Q249 45 266 52 Q275 35 289 47 Q301 34 314 46 Q333 34 341 51 Q358 44 363 62 Q379 62 375 79 Q389 90 375 103 L367 139 Q358 133 357 112 Q346 117 338 104 Q326 113 315 103 Q301 112 290 102 Q280 114 267 107 Q253 118 245 105 L239 138Z','url(#h-hair)')+
   path('M232 85 Q240 66 254 74 Q262 53 279 65 Q290 49 305 59 Q320 44 334 62 Q348 53 356 72 Q339 66 330 79 Q314 65 304 77 Q288 66 278 82 Q262 72 252 91 Q241 87 232 94Z','url(#h-hair-light)')+
   ['M237 91 Q238 80 248 80 Q258 84 251 91','M260 72 Q263 61 275 68','M280 93 Q277 81 288 78 Q299 79 296 89','M306 63 Q316 55 323 67','M313 97 Q313 86 324 86 Q334 88 332 99','M344 79 Q346 68 358 77','M360 101 Q370 92 373 102'].map(d=>line(d,mix(p.hair,'#D9B69A',.32),2.3,'opacity=".6"')).join('');
  if(p.hairStyle==='swept')return path('M234 142 Q225 128 228 112 C218 102 226 84 242 78 Q237 59 263 57 C274 37 292 37 307 44 Q327 32 340 49 Q362 45 368 67 C383 80 379 106 366 124 L358 110 Q356 88 341 83 C322 96 304 99 285 90 Q262 91 243 119 L241 145Z','url(#h-hair)')+
   path('M231 102 C260 95 266 62 292 56 Q311 47 329 54 C301 54 293 80 271 91 Q247 106 231 108Z','url(#h-hair-light)')+
   path('M270 84 C290 76 298 55 320 54 Q339 51 352 65 C329 56 316 77 297 85 Q280 92 270 84Z','url(#h-hair-light)')+
   line('M240 100 C268 90 274 64 298 58 M309 87 Q337 75 350 82 M355 66 Q372 80 369 99',mix(p.hair,'#FFF3DF',.5),2.6,'opacity=".5"');
  if(p.hairStyle==='bob')return path('M231 141 C222 114 235 81 258 63 Q285 37 311 47 C327 40 344 50 355 62 C373 84 369 109 381 128 Q363 135 346 115 C333 101 329 82 315 78 C295 103 269 106 251 125 Q240 136 231 148Z','url(#h-hair)')+
   path('M238 117 C259 88 279 59 307 57 Q288 63 280 85 C265 102 255 114 238 122Z','url(#h-hair-light)')+
   line('M248 111 Q270 79 291 72 M332 61 C355 70 352 104 368 117',mix(p.hair,'#E0B5A0',.37),2.6,'opacity=".6"');
  return path('M228 146 C227 112 237 82 256 65 C276 44 307 42 324 59 Q347 51 361 73 C372 95 366 119 378 134 Q359 134 344 119 C330 105 327 82 315 79 C300 78 281 104 265 123 Q247 144 228 150Z','url(#h-hair)')+
   path('M233 141 C255 120 265 88 287 71 Q301 59 313 61 C290 67 282 102 260 126 Q245 141 233 145Z','url(#h-hair-light)')+
   line('M241 131 C263 110 267 82 291 69 M334 76 Q336 107 366 126',mix(p.hair,'#E1B691',.38),2.4,'opacity=".55"');
 }
 function eye(side,p){const x=301+(side==='l'?-1:1)*p.anatomy.eyeGap;return `<g transform="translate(${x} 143) scale(${p.anatomy.eye})"><g id="h-eye-${side}">
 <path id="h-eye-white-${side}" d="M-18 0 C-18-30 18-30 18 0 C18 23-18 23-18 0Z" fill="#FFFBF4"/>
 <g clip-path="url(#h-eye-clip-${side})"><g id="h-pupil-${side}"><ellipse cx="1" cy="1" rx="12.2" ry="16.5" fill="url(#h-iris)"/><ellipse cx="1" cy="1" rx="7.8" ry="12" fill="#302627"/><ellipse cx="-3.5" cy="-6" rx="3.8" ry="4.5" fill="#fff"/><circle cx="7" cy="7" r="1.7" fill="#fff4dc"/></g></g>
 <path id="h-lid-${side}" d="M-18 0 C-18-30 18-30 18 0" fill="none" stroke="${mix(p.hair,'#302128',.35)}" stroke-width="${p.female?2.8:2}" stroke-linecap="round"/>
 <path id="h-eye-closed-${side}" d="M-17 0 Q0 -9 17 0" fill="none" stroke="${p.hair}" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
 ${p.female?line(side==='l'?'M-16 -9 l-4 -4 M-13 -16 l-4 -4':'M16 -9 l4 -4 M13 -16 l4 -4',p.hair,2.2,`id="h-lashes-${side}"`):''}</g></g>`;}
 function beard(p){if(!p.beard)return '';
  // Skin stays continuous from cheeks to lips; the beard follows the jaw below it.
  return path(p.glasses?'M239 161 Q246 170 248 184 Q254 194 263 196 C273 219 289 224 302 224 C326 224 341 208 344 190 Q356 180 364 159 C368 190 352 221 336 233 Q317 247 296 243 C264 241 240 218 237 192Z':'M238 160 Q246 169 248 183 Q256 193 264 196 C274 218 290 222 302 222 C324 222 340 208 344 189 Q357 179 364 157 C367 186 357 213 341 226 Q323 240 303 240 C278 239 252 226 243 205 Q237 188 238 160Z','url(#h-hair)')+
   path('M243 180 Q247 213 278 231 C261 218 258 204 253 190Z','url(#h-hair-light)')+
   line('M249 194 Q254 210 264 217 M274 230 Q286 239 300 238 M341 211 Q336 223 325 228',mix(p.hair,'#E8CCB1',.35),1.5,'opacity=".5"');
 }
 function head(p){const jaw=p.glasses?'M237 120 C235 87 260 70 300 72 C341 69 366 91 364 122 L365 170 C364 207 341 231 302 234 C266 234 239 211 237 174Z':p.headset?'M240 120 C239 89 259 73 301 74 C341 72 363 94 362 124 L361 170 C359 203 335 228 302 233 C269 230 245 208 240 178Z':'M237 119 C236 88 260 70 300 71 C342 69 366 90 364 122 L364 171 C365 209 339 232 302 234 C263 234 239 209 237 174Z';
  return `<g id="h-head"><g transform="${headTransform(p)}">
 <g fill="url(#h-skin)"><ellipse cx="235" cy="165" rx="12" ry="20" transform="rotate(-15 235 165)"/><ellipse cx="367" cy="165" rx="12" ry="20" transform="rotate(15 367 165)"/></g>
 ${line('M235 176 Q226 160 235 155 M367 176 Q376 161 367 155',mix(p.skin,'#A6544A',.4),2.8,'opacity=".45"')}
 ${path(jaw,'url(#h-skin)')}<ellipse cx="277" cy="117" rx="41" ry="35" fill="url(#h-face-light)"/>
 <g id="h-blush" opacity=".7"><ellipse cx="255" cy="172" rx="19" ry="13" fill="url(#h-blush-gradient)"/><ellipse cx="347" cy="172" rx="19" ry="13" fill="url(#h-blush-gradient)"/></g>
 ${beard(p)}${eye('l',p)}${eye('r',p)}
 ${line(p.headset?'M257 114 Q270 108 283 113':p.vestButtons?'M255 116 Q268 106 284 112':'M257 115 Q270 105 283 112',p.hair,p.female?3.8:5.8,'id="h-brow-l"')}${line(p.headset?'M319 113 Q332 108 345 114':p.vestButtons?'M318 112 Q335 105 348 116':'M318 112 Q332 105 345 115',p.hair,p.female?3.8:5.8,'id="h-brow-r"')}
 ${path('M297 156 C297 163 290 173 296 177 Q303 181 309 176 Q312 172 305 163Z','url(#h-nose)')}${line('M298 176 Q303 178 307 175','#C38168',1,'opacity=".38"')}
 ${p.beard?path('M278 190 Q281 183 290 185 Q299 187 302 185 Q307 187 315 185 Q324 183 328 190 Q319 196 302 190 Q287 197 278 190Z','url(#h-hair)'):''}
 <g id="mouth" transform="translate(302 ${p.anatomy.mouthY}) scale(${p.anatomy.mouthScale})"><path id="mouth-fill" fill="#683B37"/><g clip-path="url(#h-mouth-clip)"><path id="teeth" fill="#FFFCF2"/><path id="lower-teeth" fill="#F8EADF" opacity="0"/><ellipse id="tongue" cx="0" cy="18" rx="13" ry="6" fill="#DE8583"/></g><path id="mouth-edge" d="M-18 -1.5 Q0 4 18 -1.5" fill="none" stroke="${p.beard?'#845347':'#AF6A62'}" stroke-width="1.8" stroke-linecap="round"/></g>
 ${!p.beard?line('M291 207 Q302 211 313 207',mix(p.skin,'#CA8573',.25),1.8,'id="h-lower-lip" opacity=".3"'):''}
 <g id="h-tears" opacity="0" fill="#B5DCF0"><path d="M253 164 Q244 181 254 186 Q265 182 253 164Z"/><path d="M349 164 Q340 181 350 186 Q361 182 349 164Z"/></g>
 ${hairFront(p)}
 ${p.glasses?`<g fill="none" stroke="#56514A" stroke-width="2.7"><circle cx="272" cy="144" r="24"/><circle cx="330" cy="144" r="24"/><path d="M296 141 Q301 137 306 141 M248 140 L237 137 M354 140 L366 137"/><path d="M254 132 Q262 123 274 125 M312 131 Q320 123 332 125" stroke="#FFF9F3" stroke-width="1.5" opacity=".65"/></g>`:''}
 ${p.headset?`<g fill="none" stroke="#8D7D83" stroke-width="2.4"><ellipse cx="240" cy="191" rx="4" ry="7"/><ellipse cx="365" cy="191" rx="4" ry="7"/><path d="M368 141 Q377 169 359 181 L339 191"/><ellipse cx="336" cy="192" rx="6" ry="3.6" fill="#716A79"/></g>`:''}
 </g></g>`;
 }
 function legs(p){const wide=p.female,left=wide?'M257 369 Q279 363 302 375 L298 433 Q295 461 294 493 Q270 501 246 493 C249 472 248 458 252 434Z':'M251 371 Q280 364 302 375 L297 435 L288 494 Q268 501 247 494 Q254 469 251 446Z';
  const right=wide?'M302 375 Q329 366 348 372 L353 437 Q357 469 367 493 Q344 501 319 495 C318 473 313 450 306 433Z':'M302 375 Q329 366 351 373 L351 437 Q350 466 362 494 Q342 501 321 494 L313 437Z';
  return path(left,'url(#h-pants)')+path(right,'url(#h-pants)')+
   path('M298 385 Q304 410 298 433 L288 488 Q294 450 287 429Z',mix(p.pants,'#5B4B48',.14),'opacity=".5"')+
   line(wide?'M274 402 Q265 438 262 482 M329 400 Q328 441 346 485':'M270 402 Q266 422 269 439 M330 402 Q325 425 336 452',mix(p.pants,'#685445',.24),1.4,'opacity=".5"')+
   line('M251 482 Q266 487 278 483 M332 486 Q348 483 359 488',mix(p.pants,'#FFFFFF',.25),2,'opacity=".6"')+
   path('M253 488 Q268 494 286 489 L287 507 Q278 518 243 514 Q234 513 238 506 Q242 496 253 488Z','url(#h-shoes)')+
   path('M322 490 Q339 494 355 488 Q358 498 371 503 Q382 510 374 515 Q349 520 320 512Z','url(#h-shoes)')+
   line('M240 511 Q263 518 284 509 M323 510 Q350 519 375 512',mix(p.shoe,'#3E3030',.25),2.5)+
   line('M253 499 Q263 502 275 499 M251 503 Q263 506 275 503 M333 499 L351 501 M333 503 L356 506',mix(p.shoe,p.shirt,.5),1.6);
 }
 function wardrobe(p){const cardigan=p.outfit==='cardigan',broad=p.vestButtons,short=p.headset;return `<g id="h-body">${legs(p)}
 ${path('M280 220 L322 220 L326 249 Q319 265 302 268 Q283 261 276 249Z','url(#h-skin)')}
 ${path('M280 226 Q301 237 322 226 L322 240 Q302 252 279 240Z',mix(p.skin,'#AF6F56',.25),'opacity=".4"')}
 ${path('M277 243 Q301 254 325 241 L346 265 L340 380 Q302 391 263 380 L256 266Z','url(#h-shirt)')}
 ${!p.female?path('M270 270 L301 290 L333 270 L342 378 Q303 393 260 378Z','url(#h-knit)')+line('M279 275 L302 299 L326 275',mix(p.knit,'#FFFFFF',.35),3)+path('M279 240 L300 260 L287 276 Q275 265 273 249 M323 240 L302 260 L316 276 Q329 264 332 249','url(#h-shirt)'):path('M279 243 Q302 257 325 243 L330 253 Q301 269 273 254Z','url(#h-shirt)')}
 ${line('M274 328 Q281 331 287 329 M313 365 Q325 369 335 365',mix(p.shirt,'#BC9F89',.3),1.5,'opacity=".5"')}
 ${p.vestButtons?line('M302 300 L302 379',mix(p.knit,'#665345',.3),1.2)+[314,334,354,374].map(y=>`<circle cx="302" cy="${y}" r="2.4" fill="#97755B"/>`).join('')+line('M270 345 L286 347 M318 347 L335 344','#A08A6D',2):''}
 ${path(cardigan?'M278 245 C261 242 246 250 241 265 Q235 300 243 327 L237 391 Q247 403 272 399 C284 366 282 310 278 245Z':short?'M279 243 Q252 241 240 262 L247 318 Q244 347 240 379 Q255 388 277 382 L290 304Z':`M278 241 Q${broad?247:251} 241 ${broad?235:240} 262 Q240 292 243 321 L235 392 Q257 407 279 393 L291 302Z`,'url(#h-coat)')}
 ${path(cardigan?'M325 245 C344 240 359 252 364 269 Q367 296 361 327 L369 391 Q351 403 331 397 C320 370 319 311 325 245Z':short?'M324 242 Q352 242 365 263 L357 317 Q361 348 366 379 Q350 388 328 382 L312 304Z':`M325 241 Q${broad?356:351} 241 ${broad?369:364} 263 L360 321 L370 392 Q348 407 326 393 L312 302Z`,'url(#h-coat)')}
 ${cardigan?line('M278 249 Q285 330 273 396 M326 249 Q319 326 332 394',mix(p.coat,'#FFF1E5',.24),5.5):path('M273 244 Q262 253 258 267 L269 277 L260 287 L284 320 L292 294Z','url(#h-lapel)')+path('M329 244 Q340 255 345 269 L333 278 L342 288 L318 320 L312 294Z','url(#h-lapel)')}
 ${path('M244 349 Q255 353 270 352 L267 373 Q253 378 242 370Z',mix(p.coat,'#53474A',.11),'opacity=".65"')}${line('M244 349 Q257 353 270 352',mix(p.coat,'#FFF3DA',.22),1.5)}
 ${path('M333 352 Q347 353 360 349 L363 370 Q349 378 335 373Z',mix(p.coat,'#53474A',.11),'opacity=".65"')}${line('M333 352 Q349 353 360 349',mix(p.coat,'#FFF3DA',.22),1.5)}
 ${line('M242 386 Q254 395 272 390 M333 390 Q351 396 363 386',mix(p.coat,'#EEE0CC',.23),1.6,'opacity=".7"')}
 ${[333,359,385].slice(0,cardigan?3:2).map(y=>`<circle cx="${cardigan?326:319}" cy="${y}" r="2.5" fill="${mix(p.coat,'#655344',.35)}" stroke="${mix(p.coat,'#FFFFFF',.28)}" stroke-width=".8"/>`).join('')}
 ${p.headset?`<path d="M278 369 Q301 373 324 369 V376 Q301 380 278 376Z" fill="#69525B"/><rect x="297" y="369" width="11" height="9" rx="1.5" fill="none" stroke="#CBB184" stroke-width="1.8"/>`:''}
 </g>`;}
 function hand(side,p){return `<g id="h-hand-${side}"><g transform="${side==='l'?'scale(-1 1)':''}"><path id="h-palm-${side}" fill="url(#h-skin)"/>${line('M-5 -13 Q0 -10 4 -7 M1 -20 L2 -15 M7 -21 L7 -16 M13 -19 L12 -14',mix(p.skin,'#AA6353',.4),.75,`id="h-fingers-${side}" opacity=".24"`)}</g></g>`;}
 function arms(p){return ['l','r'].map(side=>`<g id="h-arm-${side}"><path id="h-sleeve-${side}" fill="url(#h-coat)"/><path id="h-sleeve-light-${side}" fill="none" stroke="${mix(p.coat,'#FFFFFF',.24)}" stroke-width="3.5" stroke-linecap="round" opacity=".4"/><path id="h-sleeve-fold-${side}" fill="none" stroke="${mix(p.coat,'#54474B',.3)}" stroke-width="1.2" stroke-linecap="round" opacity=".38"/>${hand(side,p)}<path id="h-cuff-${side}" fill="url(#h-shirt)"/></g>`).join('');}
 function render(id,{portrait=false,prefix=''}={}){
  if(!Object.hasOwn(presets,id))throw new Error('Unknown human preset');if(prefix&&!/^[a-zA-Z][\w-]*$/.test(prefix))throw new Error('Invalid SVG prefix');const p=presets[id];
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'211 34 180 212':'75 -10 450 550'}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="h-title"><title id="h-title">${escape(p.name)}</title><defs>
 ${gradient('h-coat',p.coat,.23).replace('x1="0%" y1="0%" x2="100%" y2="80%"','gradientUnits="userSpaceOnUse" x1="218" y1="241" x2="393" y2="412"')}${gradient('h-lapel',mix(p.coat,'#FFFFFF',.09),.2)}${gradient('h-pants',p.pants,.14)}${gradient('h-shirt',p.shirt,.09)}${gradient('h-knit',p.knit,.15)}${gradient('h-hair',p.hair,.34)}${gradient('h-hair-light',mix(p.hair,'#EAD0B5',.18),.25)}${gradient('h-shoes',p.shoe,.3)}${gradient('h-iris',p.eyes,.5)}
 <radialGradient id="h-skin" cx=".32" cy=".23" r=".86"><stop stop-color="${mix(p.skin,'#FFF5DC',.63)}"/><stop offset=".6" stop-color="${p.skin}"/><stop offset="1" stop-color="${mix(p.skin,'#AE6559',.24)}"/></radialGradient>
 <radialGradient id="h-face-light"><stop stop-color="#FFF7E9" stop-opacity=".3"/><stop offset="1" stop-color="#FFF7E9" stop-opacity="0"/></radialGradient>
 <radialGradient id="h-blush-gradient"><stop stop-color="#EC8D82" stop-opacity=".6"/><stop offset="1" stop-color="#EF9F8A" stop-opacity="0"/></radialGradient>
 <radialGradient id="h-nose" cx=".35" cy=".2"><stop stop-color="${mix(p.skin,'#FFF4DD',.4)}"/><stop offset="1" stop-color="${mix(p.skin,'#D3846E',.4)}"/></radialGradient>
 <radialGradient id="h-shadow-paint"><stop stop-color="#6D5C4C" stop-opacity=".2"/><stop offset="1" stop-color="#6D5C4C" stop-opacity="0"/></radialGradient>
 <clipPath id="h-mouth-clip"><path id="mouth-cut"/></clipPath>
 ${['l','r'].map(side=>`<clipPath id="h-eye-clip-${side}"><path id="h-eye-cut-${side}" d="M-18 0 C-18-30 18-30 18 0 C18 23-18 23-18 0Z"/></clipPath>`).join('')}</defs>
 <ellipse id="h-shadow" cx="304" cy="514" rx="87" ry="12" fill="url(#h-shadow-paint)"/>
 <g id="h-character"><g id="h-hair-back"><g transform="${headTransform(p)}">${hairBack(p)}</g></g>${wardrobe(p)}${head(p)}${arms(p)}</g></svg>`;
  if(prefix)svg=svg.replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix+id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix+id})`).replace('aria-labelledby="h-title"',`aria-labelledby="${prefix}h-title"`);
  return svg;
 }
 host.HumanArt={render,presets};
})(typeof window!=='undefined'?window:this);
