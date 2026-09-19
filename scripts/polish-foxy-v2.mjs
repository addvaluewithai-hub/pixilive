import { readFile, writeFile } from 'node:fs/promises';

const sceneUrl = new URL('../rive/foxy/scene.rml', import.meta.url);
let scene = await readFile(sceneUrl, 'utf8');

// 1) Replace the malformed mirrored-Bezier ears with clean animation-safe triangles.
const leftEarPattern = /<Node x="-99" y="-112" rotation="-0\.1" name="LeftEarControl" id="0:400">[\s\S]*?<\/Node>/;
const rightEarPattern = /<Node x="99" y="-112" rotation="0\.1" name="RightEarControl" id="0:404">[\s\S]*?<\/Node>/;

const leftEar = `<Node x="-98" y="-111" rotation="-0.08" name="LeftEarControl" id="0:400">
  <Shape name="LeftEar" id="0:401"><Triangle width="112" height="158" originX="0.5" originY="0.58" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF47B2D" name="Color"/></Fill><Stroke thickness="3.5" join="round" name="Outline"><SolidColor colorValue="FF8A421F" name="Color"/></Stroke></Shape>
  <Shape y="10" name="LeftInnerEar" id="0:402"><Triangle width="61" height="96" originX="0.5" originY="0.58" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFE9D3" name="Color"/></Fill></Shape>
</Node>`;
const rightEar = `<Node x="98" y="-111" rotation="0.08" name="RightEarControl" id="0:404">
  <Shape name="RightEar" id="0:405"><Triangle width="112" height="158" originX="0.5" originY="0.58" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF47B2D" name="Color"/></Fill><Stroke thickness="3.5" join="round" name="Outline"><SolidColor colorValue="FF8A421F" name="Color"/></Stroke></Shape>
  <Shape y="10" name="RightInnerEar" id="0:406"><Triangle width="61" height="96" originX="0.5" originY="0.58" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFE9D3" name="Color"/></Fill></Shape>
</Node>`;

if (!leftEarPattern.test(scene) || !rightEarPattern.test(scene)) throw new Error('Foxy ear blocks not found');
scene = scene.replace(leftEarPattern, leftEar).replace(rightEarPattern, rightEar);

// 2) Reduce the moustache-like muzzle. Keep it broad/soft but leave visual room for the mouth.
scene = scene
  .replace('x="-52" y="48" name="LeftMuzzle" id="0:410"><Ellipse width="118" height="94"', 'x="-43" y="47" name="LeftMuzzle" id="0:410"><Ellipse width="101" height="80"')
  .replace('x="52" y="48" name="RightMuzzle" id="0:411"><Ellipse width="118" height="94"', 'x="43" y="47" name="RightMuzzle" id="0:411"><Ellipse width="101" height="80"')
  .replace('x="0" y="66" name="ChinPatch" id="0:413"><Ellipse width="78" height="52"', 'x="0" y="63" name="ChinPatch" id="0:413"><Ellipse width="70" height="44"');

// 3) Add a top-most face performance layer. Rive's authored draw order meant the old
// mouth/fx layers sat behind the cream muzzle, so semantic states were changing values
// without reading visually. These stable top IDs become the actual expression surface.
const faceAnchor = '<Node x="0" y="0" name="Face" id="0:219">';
const topFace = `${faceAnchor}
  <Node x="0" y="0" name="TopExpressionLayer" id="0:600">
    <Node x="0" y="0" opacity="0" name="TopTears" id="0:601"><DataBindContext sourcePathIds="0:800-0:835" propertyKey="18"/>
      <Shape x="-91" y="26" rotation="-0.12" name="TopLeftTear" id="0:602"><PointsPath isClosed="true" name="Path"><CubicMirroredVertex x="0" y="-16" rotation="0" distance="7"/><CubicMirroredVertex x="11" y="5" rotation="0.4" distance="7"/><CubicMirroredVertex x="0" y="19" rotation="0" distance="7"/><CubicMirroredVertex x="-11" y="5" rotation="-0.4" distance="7"/></PointsPath><Fill name="Fill"><SolidColor colorValue="FF58BDF2" name="Color"/></Fill></Shape>
      <Shape x="91" y="26" rotation="0.12" name="TopRightTear" id="0:603"><PointsPath isClosed="true" name="Path"><CubicMirroredVertex x="0" y="-16" rotation="0" distance="7"/><CubicMirroredVertex x="11" y="5" rotation="0.4" distance="7"/><CubicMirroredVertex x="0" y="19" rotation="0" distance="7"/><CubicMirroredVertex x="-11" y="5" rotation="-0.4" distance="7"/></PointsPath><Fill name="Fill"><SolidColor colorValue="FF58BDF2" name="Color"/></Fill></Shape>
    </Node>
    <Node x="0" y="0" opacity="0" name="TopSparkles" id="0:604"><DataBindContext sourcePathIds="0:800-0:836" propertyKey="18"/>
      <Shape x="-161" y="-55" rotation="-0.55" name="TopSparkL1" id="0:605"><Rectangle width="9" height="34" originX="0.5" originY="0.5" cornerRadiusTL="4" cornerRadiusTR="4" cornerRadiusBL="4" cornerRadiusBR="4" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF7B51C" name="Color"/></Fill></Shape>
      <Shape x="-176" y="-22" rotation="-1.02" name="TopSparkL2" id="0:606"><Rectangle width="8" height="25" originX="0.5" originY="0.5" cornerRadiusTL="4" cornerRadiusTR="4" cornerRadiusBL="4" cornerRadiusBR="4" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF7B51C" name="Color"/></Fill></Shape>
      <Shape x="161" y="-55" rotation="0.55" name="TopSparkR1" id="0:607"><Rectangle width="9" height="34" originX="0.5" originY="0.5" cornerRadiusTL="4" cornerRadiusTR="4" cornerRadiusBL="4" cornerRadiusBR="4" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF7B51C" name="Color"/></Fill></Shape>
      <Shape x="176" y="-22" rotation="1.02" name="TopSparkR2" id="0:608"><Rectangle width="8" height="25" originX="0.5" originY="0.5" cornerRadiusTL="4" cornerRadiusTR="4" cornerRadiusBL="4" cornerRadiusBR="4" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF7B51C" name="Color"/></Fill></Shape>
    </Node>
    <Shape x="0" y="65" opacity="0" name="TopExpressionOpenMouth" id="0:609"><DataBindContext sourcePathIds="0:800-0:834" propertyKey="18"/><Ellipse width="57" height="52" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FF36211C" name="Color"/></Fill></Shape>
    <Shape x="0" y="76" opacity="0" name="TopExpressionTongue" id="0:610"><DataBindContext sourcePathIds="0:800-0:834" propertyKey="18"/><Ellipse width="35" height="16" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF58D88" name="Color"/></Fill></Shape>
    <Shape x="0" y="55" opacity="0" name="TopExpressionTeeth" id="0:611"><DataBindContext sourcePathIds="0:800-0:834" propertyKey="18"/><Rectangle width="38" height="10" originX="0.5" originY="0.5" cornerRadiusTL="5" cornerRadiusTR="5" cornerRadiusBL="5" cornerRadiusBR="5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFFFFF" name="Color"/></Fill></Shape>
    <Shape x="0" y="66" opacity="0" name="TopFrown" id="0:612"><DataBindContext sourcePathIds="0:800-0:833" propertyKey="18"/><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-28" y="10" rotation="-0.24" distance="13"/><CubicMirroredVertex x="0" y="-7" rotation="0" distance="16"/><CubicMirroredVertex x="28" y="10" rotation="0.24" distance="13"/></PointsPath><Stroke thickness="6" cap="round" join="round" name="Stroke"><SolidColor colorValue="FF36211C" name="Color"/></Stroke></Shape>
    <Shape x="0" y="65" opacity="0" name="TopSmile" id="0:613"><DataBindContext sourcePathIds="0:800-0:826" propertyKey="18"/><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-31" y="-3" rotation="0.32" distance="15"/><CubicMirroredVertex x="0" y="15" rotation="0" distance="18"/><CubicMirroredVertex x="31" y="-3" rotation="-0.32" distance="15"/></PointsPath><Stroke thickness="6" cap="round" join="round" name="Stroke"><SolidColor colorValue="FF36211C" name="Color"/></Stroke></Shape>
    <Shape x="0" y="65" opacity="1" name="TopNeutralMouth" id="0:614"><DataBindContext sourcePathIds="0:800-0:827" propertyKey="18"/><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-20" y="1" rotation="0.07" distance="9"/><CubicMirroredVertex x="0" y="4" rotation="0" distance="10"/><CubicMirroredVertex x="20" y="1" rotation="-0.07" distance="9"/></PointsPath><Stroke thickness="4.5" cap="round" join="round" name="Stroke"><SolidColor colorValue="FF36211C" name="Color"/></Stroke></Shape>
    <Shape x="0" y="31" name="TopNose" id="0:615"><Ellipse width="29" height="21" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FF36211C" name="Color"/></Fill></Shape>
  </Node>`;

if (!scene.includes(faceAnchor)) throw new Error('Foxy face anchor not found');
scene = scene.replace(faceAnchor, topFace);

// 4) Make the body more chibi: narrower torso, shorter/lighter mass, feet tucked in.
const bodyPattern = /<Shape x="0" y="40" rotation="0" name="BodyBase" id="0:420">[\s\S]*?<\/Shape>/;
const narrowBody = `<Shape x="0" y="48" rotation="0" name="BodyBase" id="0:420"><PointsPath isClosed="true" name="Path"><CubicMirroredVertex x="-76" y="-116" rotation="-0.16" distance="25"/><CubicMirroredVertex x="-111" y="-60" rotation="-0.28" distance="29"/><CubicMirroredVertex x="-118" y="42" rotation="-0.04" distance="31"/><CubicMirroredVertex x="-96" y="138" rotation="0.20" distance="29"/><CubicMirroredVertex x="-54" y="179" rotation="0.18" distance="24"/><CubicMirroredVertex x="0" y="190" rotation="0" distance="25"/><CubicMirroredVertex x="54" y="179" rotation="-0.18" distance="24"/><CubicMirroredVertex x="96" y="138" rotation="-0.20" distance="29"/><CubicMirroredVertex x="118" y="42" rotation="0.04" distance="31"/><CubicMirroredVertex x="111" y="-60" rotation="0.28" distance="29"/><CubicMirroredVertex x="76" y="-116" rotation="0.16" distance="25"/><CubicMirroredVertex x="0" y="-128" rotation="0" distance="28"/></PointsPath><Fill name="Fill"><SolidColor colorValue="FFF47B2D" name="Color"/></Fill><Stroke thickness="4" cap="round" join="round" name="Outline"><SolidColor colorValue="FF8A421F" name="Color"/></Stroke></Shape>`;
if (!bodyPattern.test(scene)) throw new Error('Foxy body block not found');
scene = scene.replace(bodyPattern, narrowBody);

scene = scene
  .replace('x="-60" y="217" name="LeftFoot"', 'x="-49" y="207" name="LeftFoot"')
  .replace('x="60" y="217" name="RightFoot"', 'x="49" y="207" name="RightFoot"')
  .replace('width="76" height="55"', 'width="66" height="48"')
  .replace('x="112" y="88" rotation="-0.18" name="TailControl"', 'x="130" y="74" rotation="-0.12" scaleX="1.16" scaleY="1.10" name="TailControl"');

await writeFile(sceneUrl, scene);
console.log('polished Foxy v2 face order, ears and proportions');
