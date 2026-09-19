import { readFile, writeFile } from 'node:fs/promises';

const url = new URL('../rive/foxy/scene.rml', import.meta.url);
let rml = await readFile(url, 'utf8');

function mustReplace(from, to, label = from) {
  if (!rml.includes(from)) throw new Error(`Expected Foxy v4 marker missing: ${label}`);
  rml = rml.replace(from, to);
}

function replaceExactCount(from, to, count, label = from) {
  const found = rml.split(from).length - 1;
  if (found !== count) throw new Error(`Expected ${count} Foxy v4 markers for ${label}, found ${found}`);
  rml = rml.split(from).join(to);
}

function mutateShape(name, mutator) {
  const marker = `name="${name}"`;
  const markerIndex = rml.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing ${name}`);
  const start = rml.lastIndexOf('<Shape', markerIndex);
  const end = rml.indexOf('</Shape>', markerIndex) + '</Shape>'.length;
  const before = rml.slice(start, end);
  const after = mutator(before);
  if (after === before) throw new Error(`No visual mutation applied to ${name}`);
  rml = rml.slice(0, start) + after + rml.slice(end);
}

// Keep helper-local art ids away from face-control ids.
for (const [from, to] of [
  ['name="LeftEyeShine" id="0:225"', 'name="LeftEyeShine" id="0:245"'],
  ['name="LeftEyeShineSmall" id="0:226"', 'name="LeftEyeShineSmall" id="0:246"'],
  ['name="LeftEye" id="0:224"', 'name="LeftEye" id="0:244"'],
]) mustReplace(from, to);

// Foxy performance is package-driven. Do not let legacy manual rotations fight IK.
for (const propertyId of [820, 821, 822, 823]) {
  const binding = `<DataBindContext sourcePathIds="0:800-0:${propertyId}" propertyKey="15"/>`;
  mustReplace(binding, '', `legacy joint binding ${propertyId}`);
}

// Fox anatomy needs to reach cheeks/chin while keeping a compact folded rest pose.
// Increase the hidden bone reach and extend the soft skin with generous overlap.
replaceExactCount('RootBone length="52"', 'RootBone length="68"', 2, 'upper arm bone length');
replaceExactCount('Bone length="44"', 'Bone length="58"', 2, 'forearm bone length');
for (const name of ['LeftUpperArmSkin', 'RightUpperArmSkin']) {
  mutateShape(name, (chunk) => chunk.replace('x="26"', 'x="34"').replace('width="58"', 'width="76"'));
}
for (const name of ['LeftForearmSkin', 'RightForearmSkin']) {
  mutateShape(name, (chunk) => chunk.replace('x="23"', 'x="30"').replace('width="52"', 'width="66"'));
}
for (const name of ['LeftPawBridge', 'RightPawBridge']) {
  mutateShape(name, (chunk) => chunk.replace('x="37"', 'x="49"'));
}
// Bone-attached paw tips are mechanics only now. The visible mittens are target-bound
// art below, so elbows/wrists never read as exposed discs.
for (const name of ['LeftPawTip', 'RightPawTip']) {
  mutateShape(name, (chunk) => chunk
    .replace('<Shape ', '<Shape opacity="0" ')
    .replace('x="48"', 'x="61"'));
}

// Draw the visible paws directly on the semantic hand targets. This decouples cute
// silhouette art from the internal two-bone solver: the arm can bend however it needs
// while the audience always sees one clean mitten exactly where the performance asks.
const handArt = `<Node name="LeftHandArt" id="0:560"><DataBindContext sourcePathIds="0:800-0:828" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:829" propertyKey="14"/><Shape x="-5" y="-6" opacity="0.2" name="LeftHandHighlight" id="0:564"><Ellipse width="15" height="9" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFB05B" name="Color"/></Fill></Shape><Shape name="LeftHandMitten" id="0:562"><Ellipse width="36" height="32" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFF7F2A" name="Color"/></Fill><Stroke thickness="2.6" cap="round" join="round" name="Outline"><SolidColor colorValue="FF8A421F" name="Color"/></Stroke></Shape></Node><Node name="RightHandArt" id="0:561"><DataBindContext sourcePathIds="0:800-0:830" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:831" propertyKey="14"/><Shape x="-5" y="-6" opacity="0.2" name="RightHandHighlight" id="0:565"><Ellipse width="15" height="9" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFB05B" name="Color"/></Fill></Shape><Shape name="RightHandMitten" id="0:563"><Ellipse width="36" height="32" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFF7F2A" name="Color"/></Fill><Stroke thickness="2.6" cap="round" join="round" name="Outline"><SolidColor colorValue="FF8A421F" name="Color"/></Stroke></Shape></Node>`;
mustReplace('<Node x="0" y="-183" name="HeadAnchor" id="0:181">', `${handArt}<Node x="0" y="-183" name="HeadAnchor" id="0:181">`, 'front hand art insertion');

// Semantic tail tilt owns rotation; remove the idle writer that masks acting.
const tailIdle = '<KeyedObject objectId="0:430"><KeyedProperty propertyKey="15"><KeyFrameDouble value="-0.18" interpolationType="linear"/><KeyFrameDouble value="-0.145" interpolationType="linear" frame="120"/><KeyFrameDouble value="-0.18" interpolationType="linear" frame="240"/></KeyedProperty></KeyedObject>';
mustReplace(tailIdle, '', 'tail idle rotation conflict');

// Speech cavity should be absent at rest instead of leaving a dark hairline.
mustReplace(
  'scaleY="0.04" name="SpeechMouth" id="0:371"><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/>',
  'scaleY="0.04" name="SpeechMouth" id="0:371"><DataBindContext sourcePathIds="0:800-0:808" propertyKey="18"/><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/>',
  'speech mouth activity opacity',
);

// Brows must read at thumbnail size.
for (const name of ['LeftBrow', 'RightBrow']) {
  mutateShape(name, (chunk) => chunk
    .replace('thickness="6"', 'thickness="7.2"')
    .replace('colorValue="FFE85B18"', 'colorValue="FF2A1712"'));
}

// Wider glossy eyes feel friendlier and less vertically teary in neutral.
for (const name of ['LeftEye', 'RightEye']) {
  mutateShape(name, (chunk) => chunk.replace('width="44" height="58"', 'width="48" height="54"'));
}

// Clean rounded ear apexes; the generated Bézier handles otherwise make tiny hooks.
for (const [from, to] of [
  ['x="8" y="-60" rotation="0.08" distance="20"', 'x="5" y="-63" rotation="0.04" distance="8"'],
  ['x="-9" y="-76" rotation="-0.04" distance="18"', 'x="-3" y="-73" rotation="-0.02" distance="8"'],
  ['x="-8" y="-60" rotation="-0.08" distance="20"', 'x="-5" y="-63" rotation="-0.04" distance="8"'],
  ['x="9" y="-76" rotation="0.04" distance="18"', 'x="3" y="-73" rotation="0.02" distance="8"'],
]) mustReplace(from, to, `ear apex ${from}`);

await writeFile(url, rml);
console.log('normalized foxy v4: target-bound mitten art + hidden arm mechanics');
