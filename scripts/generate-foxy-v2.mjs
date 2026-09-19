import { mkdir, writeFile } from 'node:fs/promises';

const C = {
  bg: 'FFFFFAF4',
  fur: 'FFF47B2D',
  furLight: 'FFFF9B4C',
  furShadow: 'FFD95D1F',
  cream: 'FFFFE9D3',
  creamShadow: 'FFF1CBB3',
  dark: 'FF36211C',
  outline: 'FF8A421F',
  paw: 'FF7A3C23',
  pink: 'FFF58D88',
  blue: 'FF377ED4',
  blueDark: 'FF20599D',
  tear: 'FF58BDF2',
  gold: 'FFF7B51C',
};

const solid = (color) => `<Fill name="Fill"><SolidColor colorValue="${color}" name="Color"/></Fill>`;
const stroke = (width, color) => `<Stroke thickness="${width}" cap="round" join="round" name="Outline"><SolidColor colorValue="${color}" name="Color"/></Stroke>`;

const ellipse = (x, y, w, h, color, name, id, opts = {}) =>
  `<Shape x="${x}" y="${y}"${opts.rotation ? ` rotation="${opts.rotation}"` : ''}${opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : ''} name="${name}" id="0:${id}"><Ellipse width="${w}" height="${h}" originX="0.5" originY="0.5" name="Path"/>${solid(color)}${opts.stroke ? stroke(opts.stroke, opts.strokeColor ?? C.outline) : ''}</Shape>`;

const rect = (x, y, w, h, r, color, name, id, opts = {}) =>
  `<Shape x="${x}" y="${y}"${opts.rotation ? ` rotation="${opts.rotation}"` : ''}${opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : ''} name="${name}" id="0:${id}"><Rectangle width="${w}" height="${h}" originX="0.5" originY="0.5" cornerRadiusTL="${r}" cornerRadiusTR="${r}" cornerRadiusBL="${r}" cornerRadiusBR="${r}" name="Path"/>${solid(color)}${opts.stroke ? stroke(opts.stroke, opts.strokeColor ?? C.outline) : ''}</Shape>`;

const closedPath = (x, y, rotation, color, name, id, points, opts = {}) =>
  `<Shape x="${x}" y="${y}" rotation="${rotation}"${opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : ''} name="${name}" id="0:${id}"><PointsPath isClosed="true" name="Path">${points.map(([px, py, rot, dist]) => `<CubicMirroredVertex x="${px}" y="${py}" rotation="${rot}" distance="${dist}"/>`).join('')}</PointsPath>${solid(color)}${opts.stroke ? stroke(opts.stroke, opts.strokeColor ?? C.outline) : ''}</Shape>`;

const openPath = (x, y, rotation, color, width, name, id, points, opts = {}) =>
  `<Shape x="${x}" y="${y}" rotation="${rotation}"${opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : ''} name="${name}" id="0:${id}">${opts.bindOpacity ? `<DataBindContext sourcePathIds="0:800-0:${opts.bindOpacity}" propertyKey="18"/>` : ''}${opts.bindRotation ? `<DataBindContext sourcePathIds="0:800-0:${opts.bindRotation}" propertyKey="15"${opts.converter ? ` converterId="0:${opts.converter}"` : ''}/>` : ''}<PointsPath isClosed="false" name="Path">${points.map(([px, py, rot, dist]) => `<CubicMirroredVertex x="${px}" y="${py}" rotation="${rot}" distance="${dist}"/>`).join('')}</PointsPath><Stroke thickness="${width}" cap="round" join="round" name="Stroke"><SolidColor colorValue="${color}" name="Color"/></Stroke></Shape>`;

const ear = (side, x, rotation, idBase) => {
  const mirror = side === 'left' ? -1 : 1;
  return `<Node x="${x}" y="-112" rotation="${rotation}" name="${side === 'left' ? 'Left' : 'Right'}EarControl" id="0:${idBase}">
    ${closedPath(0, 0, 0, C.fur, `${side}Ear`, idBase + 1, [
      [-45 * mirror, 56, 0.1 * mirror, 19],
      [0, -82, 0, 22],
      [48 * mirror, 54, -0.1 * mirror, 20],
      [0, 38, 0, 18],
    ], { stroke: 3.5 })}
    ${closedPath(0, 2, 0, C.cream, `${side}InnerEar`, idBase + 2, [
      [-24 * mirror, 40, 0.08 * mirror, 12],
      [0, -49, 0, 15],
      [27 * mirror, 39, -0.08 * mirror, 13],
      [0, 27, 0, 11],
    ])}
  </Node>`;
};

const paw = (name, id, x) => `<Node x="${x}" y="0" name="${name}PawArt" id="0:${id}">
  ${ellipse(0, 0, 48, 44, C.paw, `${name}Paw`, id + 1, { stroke: 3 })}
  ${ellipse(-10, -3, 7, 7, C.creamShadow, `${name}Toe1`, id + 2)}
  ${ellipse(0, -7, 7, 7, C.creamShadow, `${name}Toe2`, id + 3)}
  ${ellipse(10, -3, 7, 7, C.creamShadow, `${name}Toe3`, id + 4)}
</Node>`;

function arm(side, nodeId, upperId, foreId, pawId, upperShapeId, foreShapeId, shoulderX, upperRotation, foreRotation, targetId, invert = false) {
  const isLeft = side === 'Left';
  const upperBinding = isLeft ? 820 : 822;
  const foreBinding = isLeft ? 821 : 823;
  return `<Node x="${shoulderX}" y="-56" name="${side}Shoulder" id="0:${nodeId}">
    <RootBone x="0" y="0" length="68" rotation="${upperRotation}" name="${side}UpperBone" id="0:${upperId}">
      <DataBindContext sourcePathIds="0:800-0:${upperBinding}" propertyKey="15"/>
      <Bone length="58" rotation="${foreRotation}" name="${side}ForeBone" id="0:${foreId}">
        <DataBindContext sourcePathIds="0:800-0:${foreBinding}" propertyKey="15"/>
        <IKConstraint targetId="0:${targetId}" parentBoneCount="1" ${invert ? 'invertDirection="true" ' : ''}strength="1" name="${side}HandIK"><DataBindContext sourcePathIds="0:800-0:832" propertyKey="172"/></IKConstraint>
        ${paw(side, pawId, 62)}
        ${rect(31, 0, 66, 36, 18, C.furShadow, `${side}ForearmShadow`, foreShapeId + 1, { opacity: 0.18 })}
        ${rect(29, -2, 62, 34, 17, C.fur, `${side}Forearm`, foreShapeId, { stroke: 3 })}
      </Bone>
      ${rect(33, 2, 72, 40, 20, C.furShadow, `${side}UpperArmShadow`, upperShapeId + 1, { opacity: 0.18 })}
      ${rect(31, 0, 68, 38, 19, C.fur, `${side}UpperArm`, upperShapeId, { stroke: 3 })}
    </RootBone>
  </Node>`;
}

const bodyShape = closedPath(0, 40, 0, C.fur, 'BodyBase', 420, [
  [-90, -123, -0.18, 30],
  [-136, -62, -0.32, 34],
  [-146, 45, -0.05, 38],
  [-120, 156, 0.22, 34],
  [-65, 210, 0.2, 28],
  [0, 222, 0, 30],
  [65, 210, -0.2, 28],
  [120, 156, -0.22, 34],
  [146, 45, 0.05, 38],
  [136, -62, 0.32, 34],
  [90, -123, 0.18, 30],
  [0, -138, 0, 34],
], { stroke: 4 });

const chestShape = closedPath(0, 76, 0, C.cream, 'ChestPatch', 421, [
  [-52, -82, -0.18, 20],
  [-72, 0, -0.05, 28],
  [-52, 95, 0.2, 24],
  [0, 119, 0, 26],
  [52, 95, -0.2, 24],
  [72, 0, 0.05, 28],
  [52, -82, 0.18, 20],
  [0, -98, 0, 22],
], { stroke: 2.5, strokeColor: C.creamShadow });

const tail = `<Node x="112" y="88" rotation="-0.18" name="TailControl" id="0:430"><DataBindContext sourcePathIds="0:800-0:839" propertyKey="15"/>
  ${closedPath(0, 0, 0, C.fur, 'TailBase', 431, [
    [-56, -30, -0.15, 22],
    [-12, -74, 0.14, 30],
    [66, -78, 0.5, 30],
    [116, -8, 1.0, 36],
    [90, 68, -0.8, 34],
    [18, 78, -0.25, 30],
    [-54, 38, 0.08, 24],
  ], { stroke: 4 })}
  ${closedPath(78, -4, 0.08, C.cream, 'TailTip', 432, [
    [-24, -47, -0.25, 17],
    [27, -37, 0.3, 18],
    [47, 2, 0.9, 17],
    [20, 45, -0.6, 19],
    [-29, 38, -0.22, 18],
    [-43, 3, 0.2, 16],
  ], { stroke: 2.5, strokeColor: C.creamShadow })}
</Node>`;

const scarf = `<Node x="0" y="-78" name="Scarf" id="0:440">
  ${closedPath(0, 0, 0, C.blue, 'ScarfBand', 441, [
    [-112, -16, -0.05, 16],
    [0, -31, 0, 18],
    [112, -16, 0.05, 16],
    [98, 20, -0.08, 14],
    [0, 31, 0, 16],
    [-98, 20, 0.08, 14],
  ], { stroke: 3, strokeColor: C.blueDark })}
  ${closedPath(38, 34, 0.12, C.blue, 'ScarfTail', 442, [
    [-32, -34, -0.2, 14],
    [28, -22, 0.2, 16],
    [44, 44, 0.7, 16],
    [-10, 26, -0.2, 15],
  ], { stroke: 3, strokeColor: C.blueDark })}
</Node>`;

const face = `
  <Node x="0" y="0" name="Face" id="0:219">
    <Node x="0" y="0" name="EyeAuto" id="0:220">
      <Node x="0" y="0" name="EyeManual" id="0:221"><DataBindContext sourcePathIds="0:800-0:824" propertyKey="17"/>
        <Node x="-58" y="-10" name="LeftEyeSocket" id="0:222">
          <Node x="0" y="3" name="LeftPupilControl" id="0:224"><DataBindContext sourcePathIds="0:800-0:803" propertyKey="13" converterId="0:701"/><DataBindContext sourcePathIds="0:800-0:804" propertyKey="14" converterId="0:702"/>
            ${ellipse(0, 0, 38, 52, C.dark, 'LeftIris', 352)}${ellipse(-8, -11, 12, 16, 'FFFFFFFF', 'LeftEyeHighlight', 358)}${ellipse(7, 6, 6, 8, 'FFFFFFFF', 'LeftEyeHighlightSmall', 359)}
          </Node>
          ${ellipse(0, 0, 72, 84, 'FFFFFFFF', 'LeftEyeWhite', 350, { stroke: 3, strokeColor: C.outline })}
        </Node>
        <Node x="58" y="-10" name="RightEyeSocket" id="0:223">
          <Node x="0" y="3" name="RightPupilControl" id="0:225"><DataBindContext sourcePathIds="0:800-0:803" propertyKey="13" converterId="0:701"/><DataBindContext sourcePathIds="0:800-0:804" propertyKey="14" converterId="0:702"/>
            ${ellipse(0, 0, 38, 52, C.dark, 'RightIris', 353)}${ellipse(-8, -11, 12, 16, 'FFFFFFFF', 'RightEyeHighlight', 368)}${ellipse(7, 6, 6, 8, 'FFFFFFFF', 'RightEyeHighlightSmall', 369)}
          </Node>
          ${ellipse(0, 0, 72, 84, 'FFFFFFFF', 'RightEyeWhite', 351, { stroke: 3, strokeColor: C.outline })}
        </Node>
      </Node>
    </Node>
    <Node x="0" y="-68" name="Brows" id="0:226"><DataBindContext sourcePathIds="0:800-0:825" propertyKey="14"/>
      ${openPath(-58, 0, -0.03, C.outline, 7, 'LeftBrow', 354, [[-22, 4, 0.12, 10], [0, -4, 0, 12], [22, 4, -0.12, 10]], { bindRotation: 838, converter: 703 })}
      ${openPath(58, 0, 0.03, C.outline, 7, 'RightBrow', 355, [[-22, 4, 0.12, 10], [0, -4, 0, 12], [22, 4, -0.12, 10]], { bindRotation: 838, converter: 704 })}
    </Node>
    <Node x="0" y="0" name="Cheeks" id="0:227"><DataBindContext sourcePathIds="0:800-0:837" propertyKey="18"/>
      ${ellipse(-93, 45, 38, 24, C.pink, 'LeftCheek', 356)}${ellipse(93, 45, 38, 24, C.pink, 'RightCheek', 357)}
    </Node>
    ${ellipse(-52, 48, 118, 94, C.cream, 'LeftMuzzle', 410)}${ellipse(52, 48, 118, 94, C.cream, 'RightMuzzle', 411)}${ellipse(0, 66, 78, 52, C.cream, 'ChinPatch', 413)}
    ${ellipse(0, 31, 29, 21, C.dark, 'Nose', 412)}
    ${openPath(0, 67, 0, C.dark, 5, 'NeutralMouth', 361, [[-22, 0, 0.08, 10], [0, 4, 0, 12], [22, 0, -0.08, 10]], { bindOpacity: 827 })}
    ${openPath(0, 64, 0, C.dark, 6, 'SmileMouth', 360, [[-34, -2, 0.34, 16], [0, 15, 0, 19], [34, -2, -0.34, 16]], { bindOpacity: 826 })}
    ${openPath(0, 66, 0, C.dark, 6, 'FrownMouth', 367, [[-30, 10, -0.26, 14], [0, -6, 0, 17], [30, 10, 0.26, 14]], { bindOpacity: 833 })}
    <Node x="0" y="69" opacity="0" name="ExpressionOpenMouth" id="0:371"><DataBindContext sourcePathIds="0:800-0:834" propertyKey="18"/>
      ${ellipse(0, 0, 62, 54, C.dark, 'ExpressionMouthDark', 372)}${ellipse(0, 13, 39, 18, C.pink, 'ExpressionTongue', 373)}${ellipse(0, -14, 39, 12, 'FFFFFFFF', 'ExpressionTeeth', 374)}
    </Node>
    <Node x="0" y="0" opacity="0" name="Tears" id="0:375"><DataBindContext sourcePathIds="0:800-0:835" propertyKey="18"/>
      ${closedPath(-102, 28, -0.18, C.tear, 'LeftTear', 376, [[0, -18, 0, 8], [12, 7, 0.4, 8], [0, 20, 0, 8], [-12, 7, -0.4, 8]])}
      ${closedPath(102, 28, 0.18, C.tear, 'RightTear', 377, [[0, -18, 0, 8], [12, 7, 0.4, 8], [0, 20, 0, 8], [-12, 7, -0.4, 8]])}
    </Node>
    <Node x="0" y="0" opacity="0" name="Sparkles" id="0:378"><DataBindContext sourcePathIds="0:800-0:836" propertyKey="18"/>
      ${rect(-154, -72, 10, 34, 5, C.gold, 'SparkLeft1', 379, { rotation: -0.55 })}${rect(-170, -42, 9, 27, 4, C.gold, 'SparkLeft2', 380, { rotation: -1.05 })}${rect(154, -72, 10, 34, 5, C.gold, 'SparkRight1', 381, { rotation: 0.55 })}${rect(170, -42, 9, 27, 4, C.gold, 'SparkRight2', 382, { rotation: 1.05 })}
    </Node>
    <Shape x="0" y="66" scaleY="0.05" name="SpeechMouth" id="0:362"><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/><Ellipse width="62" height="54" originX="0.5" originY="0.5" name="Path" id="0:364"><DataBindContext sourcePathIds="0:800-0:806" propertyKey="20" converterId="0:700"/></Ellipse>${solid(C.dark)}</Shape>
    <Shape x="0" y="54" opacity="0" name="SpeechTeeth" id="0:365"><DataBindContext sourcePathIds="0:800-0:811" propertyKey="18"/><Rectangle width="43" height="11" originX="0.5" originY="0.5" cornerRadiusTL="5" cornerRadiusTR="5" cornerRadiusBL="5" cornerRadiusBR="5" name="Path"/>${solid('FFFFFFFF')}</Shape>
    <Shape x="0" y="80" opacity="0" name="SpeechTongue" id="0:366"><DataBindContext sourcePathIds="0:800-0:812" propertyKey="18"/><Ellipse width="38" height="15" originX="0.5" originY="0.5" name="Path"/>${solid(C.pink)}</Shape>
  </Node>`;

const viewModel = `<DataConverterRangeMapper minInput="0" maxInput="1" minOutput="42" maxOutput="88" clampLower="true" clampUpper="true" name="MouthWidthPixels" id="0:700"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-12" maxOutput="12" clampLower="true" clampUpper="true" name="GazeXToPixels" id="0:701"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-9" maxOutput="9" clampLower="true" clampUpper="true" name="GazeYToPixels" id="0:702"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-0.35" maxOutput="0.35" clampLower="true" clampUpper="true" name="BrowTiltLeft" id="0:703"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="0.35" maxOutput="-0.35" clampLower="true" clampUpper="true" name="BrowTiltRight" id="0:704"/>
<ViewModel defaultInstanceId="0:801" name="FoxyVM" id="0:800">
  <ViewModelPropertyBoolean name="speaking" id="0:802"/><ViewModelPropertyNumber name="gazeX" id="0:803"/><ViewModelPropertyNumber name="gazeY" id="0:804"/><ViewModelPropertyNumber name="mouthOpen" id="0:805"/><ViewModelPropertyNumber name="mouthWidth" id="0:806"/><ViewModelPropertyNumber name="mouthRound" id="0:807"/><ViewModelPropertyNumber name="speechEnergy" id="0:808"/><ViewModelPropertyNumber name="lipPress" id="0:809"/><ViewModelPropertyNumber name="lowerLipBite" id="0:810"/><ViewModelPropertyNumber name="teeth" id="0:811"/><ViewModelPropertyNumber name="tongue" id="0:812"/><ViewModelPropertyNumber name="cornerPull" id="0:813"/>
  <ViewModelPropertyNumber name="bodyX" id="0:814"/><ViewModelPropertyNumber name="bodyY" id="0:815"/><ViewModelPropertyNumber name="bodyLean" id="0:816"/><ViewModelPropertyNumber name="headX" id="0:817"/><ViewModelPropertyNumber name="headY" id="0:818"/><ViewModelPropertyNumber name="headTilt" id="0:819"/>
  <ViewModelPropertyNumber name="leftShoulder" id="0:820"/><ViewModelPropertyNumber name="leftElbow" id="0:821"/><ViewModelPropertyNumber name="rightShoulder" id="0:822"/><ViewModelPropertyNumber name="rightElbow" id="0:823"/><ViewModelPropertyNumber name="eyeScale" id="0:824"/><ViewModelPropertyNumber name="browY" id="0:825"/><ViewModelPropertyNumber name="smileOpacity" id="0:826"/><ViewModelPropertyNumber name="neutralOpacity" id="0:827"/><ViewModelPropertyNumber name="leftHandX" id="0:828"/><ViewModelPropertyNumber name="leftHandY" id="0:829"/><ViewModelPropertyNumber name="rightHandX" id="0:830"/><ViewModelPropertyNumber name="rightHandY" id="0:831"/><ViewModelPropertyNumber name="ikStrength" id="0:832"/>
  <ViewModelPropertyNumber name="frownOpacity" id="0:833"/><ViewModelPropertyNumber name="expressionMouthOpacity" id="0:834"/><ViewModelPropertyNumber name="tearOpacity" id="0:835"/><ViewModelPropertyNumber name="sparkleOpacity" id="0:836"/><ViewModelPropertyNumber name="blushOpacity" id="0:837"/><ViewModelPropertyNumber name="browTilt" id="0:838"/><ViewModelPropertyNumber name="tailTilt" id="0:839"/>
  <ViewModelInstance exports="true" name="Default" id="0:801">
    <ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="0:802"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:803"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:804"/><ViewModelInstanceNumber propertyValue="0.035" viewModelPropertyId="0:805"/><ViewModelInstanceNumber propertyValue="0.42" viewModelPropertyId="0:806"/><ViewModelInstanceNumber propertyValue="0.06" viewModelPropertyId="0:807"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:808"/><ViewModelInstanceNumber propertyValue="0.08" viewModelPropertyId="0:809"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:810"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:811"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:812"/><ViewModelInstanceNumber propertyValue="0.1" viewModelPropertyId="0:813"/>
    <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:814"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:815"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:816"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:817"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:818"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:819"/>
    <ViewModelInstanceNumber propertyValue="1.86" viewModelPropertyId="0:820"/><ViewModelInstanceNumber propertyValue="-0.88" viewModelPropertyId="0:821"/><ViewModelInstanceNumber propertyValue="1.28" viewModelPropertyId="0:822"/><ViewModelInstanceNumber propertyValue="0.88" viewModelPropertyId="0:823"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:824"/><ViewModelInstanceNumber propertyValue="-68" viewModelPropertyId="0:825"/><ViewModelInstanceNumber propertyValue="0.05" viewModelPropertyId="0:826"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:827"/><ViewModelInstanceNumber propertyValue="-118" viewModelPropertyId="0:828"/><ViewModelInstanceNumber propertyValue="55" viewModelPropertyId="0:829"/><ViewModelInstanceNumber propertyValue="118" viewModelPropertyId="0:830"/><ViewModelInstanceNumber propertyValue="55" viewModelPropertyId="0:831"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:832"/>
    <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:833"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:834"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:835"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:836"/><ViewModelInstanceNumber propertyValue="0.72" viewModelPropertyId="0:837"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:838"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:839"/>
  </ViewModelInstance>
</ViewModel>`;

const scene = `<Rive version="1" kind="fragment">
  <Artboard defaultStateMachineId="0:100" viewModelId="0:800" viewModelInstanceId="0:801" styleId="0:5" width="800" height="800" name="Foxy" id="0:1">
    <LayoutComponentStyle name="Foxy Artboard Style" id="0:5"/>
    <Fill name="Background"><SolidColor colorValue="${C.bg}" name="Color"/></Fill>
    <Node x="400" y="522" name="CharacterRoot" id="0:180">
      <Node x="0" y="0" name="BodyControl" id="0:200"><DataBindContext sourcePathIds="0:800-0:815" propertyKey="14"/><DataBindContext sourcePathIds="0:800-0:816" propertyKey="15"/>
        <Node x="0" y="0" name="BodyIdle" id="0:201">
          <Node x="0" y="-214" name="HeadAnchor" id="0:181">
            <Node x="0" y="0" name="HeadControl" id="0:210"><DataBindContext sourcePathIds="0:800-0:818" propertyKey="14"/><DataBindContext sourcePathIds="0:800-0:819" propertyKey="15"/>
              <Node x="0" y="0" name="HeadIdle" id="0:211">
                ${face}
                ${ellipse(-54, -78, 126, 72, C.furLight, 'ForeheadHighlight', 390, { opacity: 0.14 })}
                ${ear('left', -99, -0.10, 400)}${ear('right', 99, 0.10, 404)}
                ${ellipse(0, 0, 304, 276, C.fur, 'HeadBase', 370, { stroke: 4 })}
              </Node>
            </Node>
          </Node>
          <Node x="-118" y="55" name="LeftHandTarget" id="0:280"><DataBindContext sourcePathIds="0:800-0:828" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:829" propertyKey="14"/></Node>
          <Node x="118" y="55" name="RightHandTarget" id="0:281"><DataBindContext sourcePathIds="0:800-0:830" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:831" propertyKey="14"/></Node>
          ${arm('Left', 290, 300, 301, 340, 332, 330, -102, 1.86, -0.88, 280)}
          ${arm('Right', 291, 310, 311, 350, 342, 344, 102, 1.28, 0.88, 281, true)}
          ${scarf}
          ${ellipse(-60, 217, 76, 55, C.paw, 'LeftFoot', 423, { stroke: 3 })}${ellipse(60, 217, 76, 55, C.paw, 'RightFoot', 424, { stroke: 3 })}
          ${ellipse(0, 132, 210, 110, C.furShadow, 'BodyLowerShade', 426, { opacity: 0.13 })}
          ${chestShape}
          ${bodyShape}
          ${tail}
          ${ellipse(0, 247, 250, 34, 'FF50352A', 'GroundShadow', 450, { opacity: 0.10 })}
        </Node>
      </Node>
    </Node>
    <StateMachine name="FoxyMachine" id="0:100"><StateMachineLayer name="BodyAmbient" id="0:101"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState><StateTransition stateToId="0:103"/></EntryState><AnimationState x="200" animationId="0:90" id="0:103"/></StateMachineLayer><StateMachineLayer name="BlinkAmbient" id="0:104"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState><StateTransition stateToId="0:106"/></EntryState><AnimationState x="200" animationId="0:91" id="0:106"/></StateMachineLayer></StateMachine>
    <LinearAnimation loopValue="loop" duration="210" name="BreathAndDrift" id="0:90"><KeyedObject objectId="0:201"><KeyedProperty propertyKey="14"><KeyFrameDouble value="0" interpolationType="linear"/><KeyFrameDouble value="-3" interpolationType="linear" frame="105"/><KeyFrameDouble value="0" interpolationType="linear" frame="210"/></KeyedProperty><KeyedProperty propertyKey="15"><KeyFrameDouble value="-0.002" interpolationType="linear"/><KeyFrameDouble value="0.003" interpolationType="linear" frame="105"/><KeyFrameDouble value="-0.002" interpolationType="linear" frame="210"/></KeyedProperty></KeyedObject><KeyedObject objectId="0:211"><KeyedProperty propertyKey="14"><KeyFrameDouble value="0" interpolationType="linear"/><KeyFrameDouble value="-1.4" interpolationType="linear" frame="105"/><KeyFrameDouble value="0" interpolationType="linear" frame="210"/></KeyedProperty></KeyedObject></LinearAnimation>
    <LinearAnimation loopValue="loop" duration="265" name="Blink" id="0:91"><KeyedObject objectId="0:220"><KeyedProperty propertyKey="17"><KeyFrameDouble value="1" interpolationType="linear"/><KeyFrameDouble value="1" interpolationType="linear" frame="175"/><KeyFrameDouble value="0.08" interpolationType="linear" frame="180"/><KeyFrameDouble value="1" interpolationType="linear" frame="187"/><KeyFrameDouble value="1" interpolationType="linear" frame="265"/></KeyedProperty></KeyedObject></LinearAnimation>
  </Artboard>
  ${viewModel}
</Rive>`;

const dir = new URL('../rive/foxy/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('scene.rml', dir), scene);
console.log('generated foxy v2 master');
