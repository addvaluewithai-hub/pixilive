import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFlight} from '../src/engine-app/core/flight.ts';
test('flight validates untrusted tool coordinates, enums and speeds without coercion',()=>{
 for(const value of [null,[],{}, {action:'teleport'}, {action:'move',x:NaN,y:0},{action:'move',x:0,y:Infinity},{action:'move',x:2,y:.3},{action:'move',x:'0',y:.3},{action:'move',x:0}, {action:'land',speed:0}, {action:'hover',path:'loop'}])assert.equal(parseFlight(value),null);
 assert.deepEqual(parseFlight({action:'hover'}),{action:'hover',x:.5,y:.5,speed:.5,path:'direct'});
 assert.equal(parseFlight({action:'land',y:.2})?.y,1);
});
