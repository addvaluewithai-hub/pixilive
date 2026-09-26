import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgCharacter, portrait } from '../src/engine-app/core/SvgCharacter.ts';
import { getCharacter } from '../src/engine-app/core/registry.ts';
import { performanceInstructions } from '../src/engine-app/live/performancePrompt.ts';
test('mascot adapter preserves the existing speech/perform contract and uses its own renderer',()=>{
 const events:unknown[][]=[],definition=getCharacter('fustuq');
 const rig={setEmotion:(v:string)=>events.push(['emotion',v]),setIntensity:(v:number)=>events.push(['intensity',v]),setEnergy:()=>{},setMouthPose:(v:unknown)=>events.push(['mouth',v]),setGesture:(...v:unknown[])=>events.push(['gesture',...v]),setFlight:()=>{throw new Error('ground mascot cannot fly');},stopFlight:()=>{},flightState:()=>null,cancelActions:()=>events.push(['cancel']),destroy:()=>events.push(['destroy'])};
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{value:{MascotArt:{render:(id:string,options:unknown)=>{events.push(['render',id,options]);return '<svg></svg>';}},MascotMotion:{createRig:()=>rig}},configurable:true});
 try{
  const engine={normalize:()=>{throw new Error('must not use animal geometry');},render:()=>{throw new Error('must not use animal art');},metrics:()=>({})};
  const host={innerHTML:''} as HTMLElement,character=new SvgCharacter(host,engine,definition),mouth={viseme:'AA' as const,open:.8,energy:.6};
  assert.equal(host.innerHTML,'<svg></svg>');assert.equal(definition.species,'mascot');
  character.expression('neutral',.8);character.gesture('think',4);character.mouth(mouth);assert.equal(character.fly({action:'move',x:.5,y:.5,speed:.5,path:'direct'}),false);character.cancel();character.destroy();
  assert.ok(events.some(e=>e[0]==='emotion'&&e[1]==='neutral'));assert.ok(events.some(e=>e[0]==='gesture'&&e[1]==='think'&&e[2]===4));assert.ok(events.some(e=>e[0]==='mouth'&&e[1]===mouth));assert.ok(events.some(e=>e[0]==='cancel'));assert.ok(events.some(e=>e[0]==='destroy'));
  assert.ok(portrait(engine,definition).startsWith('data:image/svg+xml'));assert.ok(performanceInstructions({name:definition.name,species:definition.species}).includes('Fustuq/فستق'));
 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
