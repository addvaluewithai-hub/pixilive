import { readFile, writeFile } from 'node:fs/promises';

const url = new URL('../rive/foxy/scene.rml', import.meta.url);
let rml = await readFile(url, 'utf8');

function mustReplace(from, to, label = from) {
  if (!rml.includes(from)) throw new Error(`Expected Foxy v4 marker missing: ${label}`);
  rml = rml.replace(from, to);
}

// Keep helper-local art ids away from face-control ids.
for (const [from, to] of [
  ['name="LeftEyeShine" id="0:225"', 'name="LeftEyeShine" id="0:245"'],
  ['name="LeftEyeShineSmall" id="0:226"', 'name="LeftEyeShineSmall" id="0:246"'],
  ['name="LeftEye" id="0:224"', 'name="LeftEye" id="0:244"'],
]) mustReplace(from, to);

// Foxy performance is package-driven. Do not let the legacy manual shoulder/elbow
// bindings fight the two-bone IK solver; authored rotations remain the rest pose.
for (const propertyId of [820, 821, 822, 823]) {
  const binding = `<DataBindContext sourcePathIds="0:800-0:${propertyId}" propertyKey="15"/>`;
  mustReplace(binding, '', `legacy joint binding ${propertyId}`);
}

// Semantic tail tilt owns the parent rotation. Remove the old idle keyframes that
// were writing to the same property and masking mood/action tail acting.
const tailIdle = '<KeyedObject objectId="0:430"><KeyedProperty propertyKey="15"><KeyFrameDouble value="-0.18" interpolationType="linear"/><KeyFrameDouble value="-0.145" interpolationType="linear" frame="120"/><KeyFrameDouble value="-0.18" interpolationType="linear" frame="240"/></KeyedProperty></KeyedObject>';
mustReplace(tailIdle, '', 'tail idle rotation conflict');

// The speech cavity used to leave a dark hairline under the authored resting mouth.
// Drive its opacity from speech energy as well as its scale from mouthOpen so it is
// completely absent when Foxy is not speaking.
mustReplace(
  'scaleY="0.04" name="SpeechMouth" id="0:371"><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/>',
  'scaleY="0.04" name="SpeechMouth" id="0:371"><DataBindContext sourcePathIds="0:800-0:808" propertyKey="18"/><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/>',
  'speech mouth activity opacity',
);

// Feature-animation readability: brows need to read at thumbnail size. Preserve
// their curves but make them dark and slightly heavier.
for (const name of ['LeftBrow', 'RightBrow']) {
  const marker = `name="${name}"`;
  const markerIndex = rml.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing ${name}`);
  const start = rml.lastIndexOf('<Shape', markerIndex);
  const end = rml.indexOf('</Shape>', markerIndex) + '</Shape>'.length;
  let chunk = rml.slice(start, end);
  chunk = chunk.replace('thickness="6"', 'thickness="7.2"');
  chunk = chunk.replace('colorValue="FFE85B18"', 'colorValue="FF2A1712"');
  rml = rml.slice(0, start) + chunk + rml.slice(end);
}

// The first v4 render exposed a tiny hook at the ear tips. Reduce Bézier handle
// lengths at the two apex vertices so both ears keep a clean rounded triangle.
for (const [from, to] of [
  ['x="8" y="-60" rotation="0.08" distance="20"', 'x="5" y="-63" rotation="0.04" distance="8"'],
  ['x="-9" y="-76" rotation="-0.04" distance="18"', 'x="-3" y="-73" rotation="-0.02" distance="8"'],
  ['x="-8" y="-60" rotation="-0.08" distance="20"', 'x="-5" y="-63" rotation="-0.04" distance="8"'],
  ['x="9" y="-76" rotation="0.04" distance="18"', 'x="3" y="-73" rotation="0.02" distance="8"'],
]) mustReplace(from, to, `ear apex ${from}`);

await writeFile(url, rml);
console.log('normalized foxy v4 ids + performance rig + art polish');
