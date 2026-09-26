const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const here=path.resolve(__dirname,'../public/character-engine');
class Target{
 constructor(){this.listeners={};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x!==fn);}
 dispatch(type,extra={}){const event={target:this,preventDefault(){},...extra};return Promise.all((this.listeners[type]||[]).map(fn=>fn(event)));}
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
let doc;
class Element extends Target{
 constructor(tag,attrs={}){super();this.originalTag=tag;this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.dataset={};this.textContent='';this.value=attrs.value??'';this.checked='checked'in attrs;this.hidden='hidden'in attrs;for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 get id(){return this.attrs.id;}
 append(...children){for(const c of children){c.parent=this;this.children.push(c);}}
 replaceChildren(...children){this.children=[];this.append(...children);}
 matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('[')){const m=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);return m[2]===undefined?m[1]in this.attrs:this.attrs[m[1]]===m[2];}return this.tagName===selector.toUpperCase();}
 querySelectorAll(s){const found=[];for(const c of this.children){if(c.matches(s))found.push(c);found.push(...c.querySelectorAll(s));}return found;}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 get outerHTML(){let a=Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('');return '<'+this.originalTag+a+'>'+esc(this.textContent)+this.children.map(c=>c.outerHTML).join('')+'</'+this.originalTag+'>';}
 getBoundingClientRect(){return {left:0,top:0,width:640,height:650};}
 click(){if(this.tagName==='A')doc.downloads.push({name:this.download,url:this.href});return this.dispatch('click');}
 focus(){doc.activeElement=this;}
}
function parse(html){
 const root=new Element('document');let stack=[root];
 for(const token of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g)){
  const raw=token[0],tag=token[1];if(raw.startsWith('</')){if(stack[stack.length-1].tagName===tag.toUpperCase())stack.pop();continue;}
  const attrs={};for(const m of raw.slice(tag.length+1).matchAll(/([\w:-]+)(?:="([^"]*)")?/g))attrs[m[1]]=m[2]??'';
  const el=new Element(tag,attrs);stack[stack.length-1].append(el);if(!/\/>$/.test(raw)&&!['input','img','meta','link','br','hr'].includes(tag.toLowerCase()))stack.push(el);
 }
 return root;
}

function setup(species='fox',reduced=false){
 const master=fs.readFileSync(path.join(here,'master.svg'),'utf8');
 doc=new Target();const tree=parse(master);doc.hidden=false;doc.activeElement=null;
 const win=new Target(),media=new Target();media.matches=reduced;win.matchMedia=()=>media;
 let frame=null,clock=0,stopped=false;
 const context={window:win,document:doc,AbortController,Math,Number,Object,Array,String,JSON,console,
 requestAnimationFrame:fn=>(frame=fn,1),cancelAnimationFrame:()=>{stopped=true;}};
 vm.createContext(context);for(const f of ['geometry.js','engine.js','flight.js','motion.js'])vm.runInContext(fs.readFileSync(path.join(here,f),'utf8'),context,{filename:f});
 const engine=win.CharacterEngine.createEngine(master),recipe=engine.normalize({species});
 engine.apply(tree.querySelector('svg'),recipe);
 const motion=win.CharacterMotion.createRig(tree,{externalControl:true,keyboard:false,appearance:()=>engine.metrics(recipe)});
 return {motion,engine,geometry:win.CharacterGeometry,$:id=>tree.querySelector('#'+id),
 tick(n=1){for(let i=0;i<n&&!stopped;i++){clock+=1000/60;frame(clock);}},svg:()=>tree.querySelector('svg').outerHTML};
}
module.exports={setup};
function setupHuman(preset='hakim',reduced=false){
 doc=new Target();doc.hidden=false;const win=new Target(),media=new Target();media.matches=reduced;win.matchMedia=()=>media;
 let frame=null,clock=0,stopped=false;
 const context={window:win,document:doc,AbortController,Math,Number,Object,Array,String,JSON,console,requestAnimationFrame:fn=>(frame=fn,1),cancelAnimationFrame:()=>{stopped=true;}};
 vm.createContext(context);for(const f of ['geometry.js','human-art.js','human-motion.js'])vm.runInContext(fs.readFileSync(path.join(here,f),'utf8'),context,{filename:f});
 const tree=parse(win.HumanArt.render(preset));
 const motion=win.HumanMotion.createRig(tree,{preset,speechMotionScale:.35});
 return {motion,art:win.HumanArt,geometry:win.CharacterGeometry,$:id=>tree.querySelector('#'+id),document:doc,media,
 tick(n=1){for(let i=0;i<n&&!stopped;i++){clock+=1000/60;frame(clock);}},svg:()=>tree.querySelector('svg').outerHTML};
}
module.exports.setupHuman=setupHuman;

function setupMascot(preset='fustuq',reduced=false){
 doc=new Target();doc.hidden=false;const win=new Target(),media=new Target();media.matches=reduced;win.matchMedia=()=>media;
 let frame=null,clock=0,stopped=false;
 const context={window:win,document:doc,AbortController,Math,Number,Object,Array,String,JSON,console,requestAnimationFrame:fn=>(frame=fn,1),cancelAnimationFrame:()=>{stopped=true;}};
 vm.createContext(context);for(const f of ['geometry.js','mascot-art.js','mascot-motion.js'])vm.runInContext(fs.readFileSync(path.join(here,f),'utf8'),context,{filename:f});
 const tree=parse(win.MascotArt.render(preset));
 const motion=win.MascotMotion.createRig(tree,{preset,speechMotionScale:.35});
 return {motion,art:win.MascotArt,geometry:win.CharacterGeometry,$:id=>tree.querySelector('#'+id),document:doc,media,
 tick(n=1){for(let i=0;i<n&&!stopped;i++){clock+=1000/60;frame(clock);}},svg:()=>tree.querySelector('svg').outerHTML};
}
module.exports.setupMascot=setupMascot;
