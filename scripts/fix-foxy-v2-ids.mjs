import { readFile, writeFile } from 'node:fs/promises';

const sceneUrl = new URL('../rive/foxy/scene.rml', import.meta.url);
let scene = await readFile(sceneUrl, 'utf8');

const replacements = [
  ['name="RightPawArt" id="0:350"', 'name="RightPawArt" id="0:550"'],
  ['name="RightPaw" id="0:351"', 'name="RightPaw" id="0:551"'],
  ['name="RightToe1" id="0:352"', 'name="RightToe1" id="0:552"'],
  ['name="RightToe2" id="0:353"', 'name="RightToe2" id="0:553"'],
  ['name="RightToe3" id="0:354"', 'name="RightToe3" id="0:554"'],
  ['name="RightUpperArm" id="0:342"', 'name="RightUpperArm" id="0:542"'],
  ['name="RightUpperArmShadow" id="0:343"', 'name="RightUpperArmShadow" id="0:543"'],
  ['name="RightForearm" id="0:344"', 'name="RightForearm" id="0:544"'],
  ['name="RightForearmShadow" id="0:345"', 'name="RightForearmShadow" id="0:545"'],
];

for (const [from, to] of replacements) {
  if (!scene.includes(from)) throw new Error(`Expected Foxy id pattern missing: ${from}`);
  scene = scene.replace(from, to);
}

await writeFile(sceneUrl, scene);
console.log('normalized Foxy v2 authored ids');
