/* Compact graphic mascots: original vector art, shared speech/perform contract. */
(function(host){
 'use strict';
 const presets={fustuq:{name:'فستق',body:'#AAD13B',shade:'#98C031',light:'#BBDC53',limb:'#719C2F',ink:'#263728',cheek:'#F5AB69'}};
 function render(id,{portrait=false,prefix=''}={}){
  if(!Object.hasOwn(presets,id))throw new Error('Unknown mascot preset');
  if(prefix&&!/^[a-zA-Z][\w-]*$/.test(prefix))throw new Error('Invalid SVG prefix');
  const p=presets[id];
  const eye=(side,x,y,rx,ry)=>`<g id="m-eye-${side}" transform="translate(${x} ${y})"><path id="m-white-${side}" d="M-${rx} 0 C-${rx} -${ry*1.333} ${rx} -${ry*1.333} ${rx} 0 C${rx} ${ry*1.333} -${rx} ${ry*1.333} -${rx} 0Z" fill="#FFFFF3"/><g clip-path="url(#m-eye-clip-${side})"><g id="m-pupil-${side}"><ellipse cx="${side==='l'?3:6}" cy="1" rx="${side==='l'?10:12.5}" ry="${side==='l'?14:17}" fill="${p.ink}"/></g></g><path id="m-closed-${side}" d="M-15 0 Q0 16 15 0" fill="none" stroke="${p.ink}" stroke-width="6" stroke-linecap="round" opacity="0"/><path id="m-brow-${side}" d="M-18 -42 Q0 -49 18 -42" fill="none" stroke="${p.ink}" stroke-width="5" stroke-linecap="round" opacity="0"/></g>`;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait?'188 148 225 245':'60 15 490 505'}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="m-title"><title id="m-title">${p.name}</title><defs>
   <clipPath id="m-eye-clip-l"><path id="m-cut-l" d="M-23 0 C-23 -36 23 -36 23 0 C23 36 -23 36 -23 0Z"/></clipPath>
   <clipPath id="m-eye-clip-r"><path id="m-cut-r" d="M-31 0 C-31 -46.6 31 -46.6 31 0 C31 46.6 -31 46.6 -31 0Z"/></clipPath>
   <clipPath id="m-mouth-clip"><path id="mouth-cut"/></clipPath>
  </defs>
  <ellipse id="m-shadow" cx="303" cy="488" rx="89" ry="9" fill="#504F3F" opacity=".12"/>
  <g id="m-character">
   <g id="m-legs" fill="none" stroke="${p.limb}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path id="m-leg-l" d="M272 399 Q275 435 252 475 L235 475"/><path id="m-leg-r" d="M333 399 Q329 434 348 474 L363 474"/></g>
   <g id="m-upper">
    <g transform="translate(0 -42)" fill="${p.limb}"><path id="arm-l"/><path id="arm-r"/></g>
    <path d="M281 137 C333 103 375 163 390 227 C408 297 397 367 359 403 C327 435 266 434 228 399 C193 367 189 309 202 257 C197 230 193 183 216 163 C234 147 255 160 264 176 C262 155 263 143 281 137Z" fill="${p.body}"/>
    <path d="M363 167 C397 231 414 343 361 397 Q323 435 277 418 C338 415 365 369 374 324 Q391 242 363 167Z" fill="${p.shade}" opacity=".55"/>
    <path d="M276 152 Q318 125 345 162 C316 145 291 159 280 185 Q269 193 271 172Z" fill="${p.light}" opacity=".5"/>
    <g id="m-face">${eye('l',261,268,23,27)}${eye('r',328,249,31,35)}
     <g id="m-cheeks" fill="${p.cheek}"><ellipse cx="246" cy="307" rx="13" ry="7" transform="rotate(-8 246 307)"/><ellipse cx="349" cy="298" rx="14" ry="7" transform="rotate(-8 349 298)"/></g>
     <g id="mouth" transform="translate(303 324) scale(.95 1.15)"><path id="mouth-fill" fill="${p.ink}"/><g clip-path="url(#m-mouth-clip)"><path id="teeth" fill="#FFFFF3"/><path id="lower-teeth" fill="#FFFFF3"/><ellipse id="tongue" cx="0" cy="18" rx="12" ry="6" fill="#EF795D"/></g><path id="mouth-edge" d="M-13 -2 Q0 13 13 -2" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round"/></g>
     <g id="m-tears" fill="#72C9D8" opacity="0"><path d="M242 300 Q232 314 242 318 Q252 316 242 300Z"/><path d="M354 292 Q344 306 354 310 Q364 308 354 292Z"/></g>
    </g>
    <g id="m-front-arms" fill="${p.limb}"><path id="m-fore-l"/><path id="m-fore-r"/></g>
    <g id="hand-l"/><g id="hand-r"/>
   </g>
  </g></svg>`;
  if(prefix)svg=svg.replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix+id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix+id})`).replace('aria-labelledby="m-title"',`aria-labelledby="${prefix}m-title"`);
  return svg;
 }
 host.MascotArt={render,presets};
})(typeof window!=='undefined'?window:this);
