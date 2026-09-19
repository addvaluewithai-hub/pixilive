import { readFile, writeFile } from 'node:fs/promises';

const url = new URL('../rive/foxy/scene.rml', import.meta.url);
let rml = await readFile(url, 'utf8');

// The art helpers intentionally use human-readable local id ranges. Normalize the
// left glossy-eye leaf ids away from the face-control range after generation.
const replacements = [
  ['name="LeftEyeShine" id="0:225"', 'name="LeftEyeShine" id="0:245"'],
  ['name="LeftEyeShineSmall" id="0:226"', 'name="LeftEyeShineSmall" id="0:246"'],
  ['name="LeftEye" id="0:224"', 'name="LeftEye" id="0:244"'],
];

for (const [from, to] of replacements) {
  if (!rml.includes(from)) throw new Error(`Expected Foxy v4 id marker missing: ${from}`);
  rml = rml.replace(from, to);
}

await writeFile(url, rml);
console.log('normalized foxy v4 eye ids');
