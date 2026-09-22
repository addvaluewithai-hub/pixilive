import test from 'node:test';
import assert from 'node:assert/strict';
import { storyBeats, storyTestPrompt } from '../src/engine-app/live/storyScript.ts';
import { performanceInstructions } from '../src/engine-app/live/performancePrompt.ts';
import { gestures, parseCue } from '../src/engine-app/core/types.ts';
test('complete story supplies all six active gestures with one valid cue per two sentences',()=>{
 assert.equal(storyBeats.length,15);
 assert.deepEqual(new Set(storyBeats.map(beat=>beat.gesture)),new Set(gestures.filter(gesture=>gesture!=='none')));
 for(const beat of storyBeats){
  assert.equal(beat.sentences.length,2);for(const sentence of beat.sentences)assert.ok(sentence.endsWith('.'));
  assert.ok(parseCue({...beat,timing:'with_speech',duration:6,intensity:.8}));
  for(const sentence of beat.sentences)assert.ok(storyTestPrompt.includes(sentence));
 }
 assert.ok(storyBeats.at(-1)!.sentences[1].includes('خلصت الحدوتة'));
 // Spoken requests and the button both have access to the full written story.
 assert.ok(performanceInstructions({name:'إمبر',species:'fox'}).includes(storyTestPrompt));
});
