import { mkdir, writeFile } from 'node:fs/promises';

// Foxy v3: art-first rebuild based on the supplied SVG expression sheet.
// The visible artwork stays soft and continuous; bones/IK remain internal.

const C = {
  bg: 'FFFFFAF4',
  fur: 'FFFF812B',
  furLight: 'FFFFAA52',
  furShadow: 'FFE75B19',
  cream: 'FFFFF7E9',
  creamShadow: 'FFF3D9C5',
  dark: 'FF2A1712',
  outline: 'FF8A421F',
  paw: 'FF5A2B1D',
  blush: 'FFFF8C88',
  blue: 'FF2F8FE8',
  blueDark: 'FF1667C4',
  tear: 'FF48B8F7',
  gold: 'FFF5C314',
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
  const m = side === 'left' ? -1 : 1;
  return `<Node x="${x}" y="-118" rotation="${rotation}" name="${side === 'left' ? 'Left' : 'Right'}Ear" id="0:${idBase}">
    ${closedPath(0, 0, 0, C.fur, `${side}EarFur`, idBase + 1, [[-44*m,54,0.1*m,18],[0,-86,0,22],[46*m,55,-0.1*m,18],[0,38,0,18]], { stroke: 3 })}
    ${closedPath(0, 1, 0, C.cream, `${side}InnerEar`, idBase + 2, [[-23*m,37,0.08*m,11],[0,-49,0,14],[25*m,38,-0.08*m,11],[0,26,0,10]])}
  </Node>`;
};

// Hidden-joint arm: segment overlap is deliberate. Internal bones can bend freely,
// while the viewer sees one soft continuous fur silhouette with no elbow disc/outline.
function arm(side, ids, shoulderX, upperRotation, foreRotation, targetId, invert = false) {
  const isLeft = side === 'Left';
  const upperBinding = isLeft ? 820 : 822;
  const foreBinding = isLeft ? 821 : 823;
  return `<Node x="${shoulderX}" y="-52" name="${side}Shoulder" id="0:${ids.node}">
    <RootBone length="70" rotation="${upperRotation}" name="${side}UpperBone" id="0:${ids.upperBone}">
      <DataBindContext sourcePathIds="0:800-0:${upperBinding}" propertyKey="15"/>
      ${ellipse(4, 0, 46, 46, C.fur, `${side}ShoulderCover`, ids.shoulderCover)}
      ${rect(34, 0, 82, 44, 22, C.fur, `${side}UpperArmSkin`, ids.upperSkin)}
      ${ellipse(23, -9, 38, 16, C.furLight, `${side}UpperArmHighlight`, ids.upperHighlight, { opacity: 0.17, rotation: -0.12 })}
      <Bone length="60" rotation="${foreRotation}" name="${side}ForeBone" id="0:${ids.foreBone}">
        <DataBindContext sourcePathIds="0:800-0:${foreBinding}" propertyKey="15"/>
        <IKConstraint targetId="0:${targetId}" parentBoneCount="1" ${invert ? 'invertDirection="true" ' : ''}strength="1" name="${side}HandIK"><DataBindContext sourcePathIds="0:800-0:832" propertyKey="172"/></IKConstraint>
        ${ellipse(-3, 0, 48, 48, C.fur, `${side}ElbowBlend`, ids.elbowBlend)}
        ${rect(30, 0, 78, 42, 21, C.fur, `${side}ForearmSkin`, ids.foreSkin)}
        ${ellipse(59, 0, 42, 40, C.paw, `${side}Paw`, ids.paw)}
        ${ellipse(49, -8, 22, 8, C.furLight, `${side}PawBlend`, ids.pawBlend, { opacity: 0.24, rotation: -0.15 })}
      </Bone>
    </RootBone>
  </Node>`;
}

const tail = `<Node x="106" y="92" rotation="-0.22" name="TailControl" id="0:430"><DataBindContext sourcePathIds="0:800-0:839" propertyKey="15"/>
  ${closedPath(0, 0, 0, C.fur, 'TailFur', 431, [[-50,-22,-0.15,20],[-18,-70,0.12,30],[58,-80,0.48,32],[116,-16,0.95,34],[96,58,-0.75,34],[28,82,-0.24,30],[-48,38,0.08,23]], { stroke: 3 })}
  ${closedPath(78, -1, 0.08, C.cream, 'TailTip', 432, [[-28,-44,-0.22,16],[25,-40,0.28,17],[45,0,0.88,16],[22,42,-0.55,18],[-30,37,-0.2,17],[-42,2,0.18,15]])}
</Node>`;

const body = `${closedPath(0, 42, 0, C.fur, 'Body', 420, [[-86,-118,-0.16,28],[-126,-62,-0.28,31],[-132,42,-0.04,34],[-106,148,0.2,31],[-56,202,0.18,26],[0,214,0,28],[56,202,-0.18,26],[106,148,-0.2,31],[132,42,0.04,34],[126,-62,0.28,31],[86,-118,0.16,28],[0,-132,0,31]], { stroke: 3 })}
${closedPath(0, 82, 0, C.cream, 'Belly', 421, [[-48,-78,-0.16,18],[-64,0,-0.04,24],[-48,88,0.18,21],[0,112,0,23],[48,88,-0.18,21],[64,0,0.04,24],[48,-78,0.16,18],[0,-94,0,20]])}
${ellipse(-54, 208, 68, 50, C.paw, 'LeftFoot', 423, { rotation: -0.05 })}${ellipse(54, 208, 68, 50, C.paw, 'RightFoot', 424, { rotation: 0.05 })}`;

const scarf = `<Node x="0" y="-74" name="Bandana" id="0:440">
  ${closedPath(0, 0, 0, C.blueDark, 'BandanaCollar', 441, [[-104,-13,-0.04,14],[0,-25,0,16],[104,-13,0.04,14],[91,18,-0.06,13],[0,27,0,15],[-91,18,0.06,13]], { stroke: 2, strokeColor: C.blueDark })}
  ${closedPath(0, 28, 0, C.blue, 'BandanaMain', 442, [[-68,-28,-0.14,16],[0,-20,0,18],[68,-28,0.14,16],[0,76,0,22]], { stroke: 2, strokeColor: C.blueDark })}
</Node>`;

const mouthSystem = `
  ${openPath(0, 42, 0, C.dark, 3.5, 'MouthStem', 360, [[0,0,0,5],[0,9,0,5]])}
  <Node x="0" y="0" opacity="1" name="NeutralMouthGroup" id="0:361"><DataBindContext sourcePathIds="0:800-0:827" propertyKey="18"/>
    ${openPath(-1, 53, 0, C.dark, 4, 'NeutralMouthLeft', 362, [[0,0,0,7],[-12,6,-0.2,8],[-22,4,0.05,7]])}
    ${openPath(1, 53, 0, C.dark, 4, 'NeutralMouthRight', 363, [[0,0,0,7],[12,6,0.2,8],[22,4,-0.05,7]])}
  </Node>
  <Node x="0" y="0" opacity="0" name="SmileMouthGroup" id="0:364"><DataBindContext sourcePathIds="0:800-0:826" propertyKey="18"/>
    ${openPath(0, 51, 0, C.dark, 4.5, 'SmileCurve', 365, [[-25,0,0.18,10],[0,12,0,13],[25,0,-0.18,10]])}
  </Node>
  <Node x="0" y="0" opacity="0" name="FrownMouthGroup" id="0:366"><DataBindContext sourcePathIds="0:800-0:833" propertyKey="18"/>
    ${openPath(0, 58, 0, C.dark, 4.5, 'FrownCurve', 367, [[-22,8,-0.18,10],[0,-5,0,12],[22,8,0.18,10]])}
  </Node>
  <Node x="0" y="58" opacity="0" name="ExpressionOpenMouth" id="0:368"><DataBindContext sourcePathIds="0:800-0:834" propertyKey="18"/>
    ${ellipse(0, 0, 48, 42, C.dark, 'ExpressionMouthCavity', 369)}
    ${ellipse(0, 10, 30, 13, 'FFFF756D', 'ExpressionTongue', 370)}
  </Node>
  <Shape x="0" y="58" scaleY="0.04" name="SpeechMouth" id="0:371"><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/><Ellipse width="48" height="42" originX="0.5" originY="0.5" name="Path" id="0:372"><DataBindContext sourcePathIds="0:800-0:806" propertyKey="20" converterId="0:700"/></Ellipse>${solid(C.dark)}</Shape>
  <Shape x="0" y="49" opacity="0" name="SpeechTeeth" id="0:373"><DataBindContext sourcePathIds="0:800-0:811" propertyKey="18"/><Rectangle width="31" height="8" originX="0.5" originY="0.5" cornerRadiusTL="4" cornerRadiusTR="4" cornerRadiusBL="4" cornerRadiusBR="4" name="Path"/>${solid('FFFFFFFF')}</Shape>
  <Shape x="0" y="68" opacity="0" name="SpeechTongue" id="0:374"><DataBindContext sourcePathIds="0:800-0:812" propertyKey="18"/><Ellipse width="28" height="10" originX="0.5" originY="0.5" name="Path"/>${solid('FFFF756D')}</Shape>`;

const face = `<Node x="0" y="0" name="Face" id="0:219">
  <Node x="0" y="0" name="EyeAuto" id="0:220"><Node x="0" y="0" name="EyeManual" id="0:221"><DataBindContext sourcePathIds="0:800-0:824" propertyKey="17"/>
    <Node x="-55" y="-13" name="LeftEyeSocket" id="0:222"><Node x="0" y="3" name="LeftPupilControl" id="0:224"><DataBindContext sourcePathIds="0:800-0:803" propertyKey="13" converterId="0:701"/><DataBindContext sourcePathIds="0:800-0:804" propertyKey="14" converterId="0:702"/>${ellipse(0,0,38,52,C.dark,'LeftPupil',350)}${ellipse(-8,-11,12,16,'FFFFFFFF','LeftEyeShine',351)}${ellipse(7,6,6,8,'FFFFFFFF','LeftEyeShineSmall',352)}</Node>${ellipse(0,0,70,82,'FFFFFFFF','LeftEyeWhite',353)}</Node>
    <Node x="55" y="-13" name="RightEyeSocket" id="0:223"><Node x="0" y="3" name="RightPupilControl" id="0:225"><DataBindContext sourcePathIds="0:800-0:803" propertyKey="13" converterId="0:701"/><DataBindContext sourcePathIds="0:800-0:804" propertyKey="14" converterId="0:702"/>${ellipse(0,0,38,52,C.dark,'RightPupil',354)}${ellipse(-8,-11,12,16,'FFFFFFFF','RightEyeShine',355)}${ellipse(7,6,6,8,'FFFFFFFF','RightEyeShineSmall',356)}</Node>${ellipse(0,0,70,82,'FFFFFFFF','RightEyeWhite',357)}</Node>
  </Node></Node>
  <Node x="0" y="-68" name="Brows" id="0:226"><DataBindContext sourcePathIds="0:800-0:825" propertyKey="14"/>${openPath(-55,0,-0.03,C.furShadow,6,'LeftBrow',380,[[-19,3,0.1,9],[0,-3,0,10],[19,3,-0.1,9]],{bindRotation:838,converter:703})}${openPath(55,0,0.03,C.furShadow,6,'RightBrow',381,[[-19,3,0.1,9],[0,-3,0,10],[19,3,-0.1,9]],{bindRotation:838,converter:704})}</Node>
  <Node x="0" y="0" name="Cheeks" id="0:227"><DataBindContext sourcePathIds="0:800-0:837" propertyKey="18"/>${ellipse(-91,39,36,22,C.blush,'LeftCheek',382)}${ellipse(91,39,36,22,C.blush,'RightCheek',383)}</Node>
  ${ellipse(-48,44,108,84,C.cream,'LeftMuzzle',384)}${ellipse(48,44,108,84,C.cream,'RightMuzzle',385)}${ellipse(0,59,64,42,C.cream,'ChinPatch',386)}
  ${ellipse(0,29,27,19,C.dark,'Nose',387)}${ellipse(-4,25,7,5,'FFFFFFFF','NoseHighlight',388,{opacity:0.72})}
  ${mouthSystem}
  <Node x="0" y="0" opacity="0" name="Tears" id="0:390"><DataBindContext sourcePathIds="0:800-0:835" propertyKey="18"/>${closedPath(-91,26,-0.15,C.tear,'LeftTear',391,[[0,-16,0,7],[10,6,0.35,7],[0,18,0,7],[-10,6,-0.35,7]])}${closedPath(91,26,0.15,C.tear,'RightTear',392,[[0,-16,0,7],[10,6,0.35,7],[0,18,0,7],[-10,6,-0.35,7]])}</Node>
  <Node x="0" y="0" opacity="0" name="Sparkles" id="0:393"><DataBindContext sourcePathIds="0:800-0:836" propertyKey="18"/>${rect(-151,-71,9,31,5,C.gold,'SparkLeft1',394,{rotation:-0.55})}${rect(-167,-42,8,24,4,C.gold,'SparkLeft2',395,{rotation:-1.05})}${rect(151,-71,9,31,5,C.gold,'SparkRight1',396,{rotation:0.55})}${rect(167,-42,8,24,4,C.gold,'SparkRight2',397,{rotation:1.05})}</Node>
</Node>`;

const viewModel = `<DataConverterRangeMapper minInput="0" maxInput="1" minOutput="34" maxOutput="66" clampLower="true" clampUpper="true" name="MouthWidthPixels" id="0:700"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-11" maxOutput="11" clampLower="true" clampUpper="true" name="GazeXToPixels" id="0:701"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-8" maxOutput="8" clampLower="true" clampUpper="true" name="GazeYToPixels" id="0:702"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-0.34" maxOutput="0.34" clampLower="true" clampUpper="true" name="BrowTiltLeft" id="0:703"/>
<DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="0.34" maxOutput="-0.34" clampLower="true" clampUpper="true" name="BrowTiltRight" id="0:704"/>
<ViewModel defaultInstanceId="0:801" name="FoxyVM" id="0:800">
  <ViewModelPropertyBoolean name="speaking" id="0:802"/><ViewModelPropertyNumber name="gazeX" id="0:803"/><ViewModelPropertyNumber name="gazeY" id="0:804"/><ViewModelPropertyNumber name="mouthOpen" id="0:805"/><ViewModelPropertyNumber name="mouthWidth" id="0:806"/><ViewModelPropertyNumber name="mouthRound" id="0:807"/><ViewModelPropertyNumber name="speechEnergy" id="0:808"/><ViewModelPropertyNumber name="lipPress" id="0:809"/><ViewModelPropertyNumber name="lowerLipBite" id="0:810"/><ViewModelPropertyNumber name="teeth" id="0:811"/><ViewModelPropertyNumber name="tongue" id="0:812"/><ViewModelPropertyNumber name="cornerPull" id="0:813"/>
  <ViewModelPropertyNumber name="bodyX" id="0:814"/><ViewModelPropertyNumber name="bodyY" id="0:815"/><ViewModelPropertyNumber name="bodyLean" id="0:816"/><ViewModelPropertyNumber name="headX" id="0:817"/><ViewModelPropertyNumber name="headY" id="0:818"/><ViewModelPropertyNumber name="headTilt" id="0:819"/><ViewModelPropertyNumber name="leftShoulder" id="0:820"/><ViewModelPropertyNumber name="leftElbow" id="0:821"/><ViewModelPropertyNumber name="rightShoulder" id="0:822"/><ViewModelPropertyNumber name="rightElbow" id="0:823"/><ViewModelPropertyNumber name="eyeScale" id="0:824"/><ViewModelPropertyNumber name="browY" id="0:825"/><ViewModelPropertyNumber name="smileOpacity" id="0:826"/><ViewModelPropertyNumber name="neutralOpacity" id="0:827"/><ViewModelPropertyNumber name="leftHandX" id="0:828"/><ViewModelPropertyNumber name="leftHandY" id="0:829"/><ViewModelPropertyNumber name="rightHandX" id="0:830"/><ViewModelPropertyNumber name="rightHandY" id="0:831"/><ViewModelPropertyNumber name="ikStrength" id="0:832"/><ViewModelPropertyNumber name="frownOpacity" id="0:833"/><ViewModelPropertyNumber name="expressionMouthOpacity" id="0:834"/><ViewModelPropertyNumber name="tearOpacity" id="0:835"/><ViewModelPropertyNumber name="sparkleOpacity" id="0:836"/><ViewModelPropertyNumber name="blushOpacity" id="0:837"/><ViewModelPropertyNumber name="browTilt" id="0:838"/><ViewModelPropertyNumber name="tailTilt" id="0:839"/>
  <ViewModelInstance exports="true" name="Default" id="0:801">
    <ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="0:802"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:803"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:804"/><ViewModelInstanceNumber propertyValue="0.035" viewModelPropertyId="0:805"/><ViewModelInstanceNumber propertyValue="0.42" viewModelPropertyId="0:806"/><ViewModelInstanceNumber propertyValue="0.06" viewModelPropertyId="0:807"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:808"/><ViewModelInstanceNumber propertyValue="0.08" viewModelPropertyId="0:809"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:810"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:811"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:812"/><ViewModelInstanceNumber propertyValue="0.1" viewModelPropertyId="0:813"/>
    <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:814"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:815"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:816"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:817"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:818"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:819"/><ViewModelInstanceNumber propertyValue="1.88" viewModelPropertyId="0:820"/><ViewModelInstanceNumber propertyValue="-0.9" viewModelPropertyId="0:821"/><ViewModelInstanceNumber propertyValue="1.26" viewModelPropertyId="0:822"/><ViewModelInstanceNumber propertyValue="0.9" viewModelPropertyId="0:823"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:824"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:825"/><ViewModelInstanceNumber propertyValue="0.04" viewModelPropertyId="0:826"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:827"/><ViewModelInstanceNumber propertyValue="-112" viewModelPropertyId="0:828"/><ViewModelInstanceNumber propertyValue="58" viewModelPropertyId="0:829"/><ViewModelInstanceNumber propertyValue="112" viewModelPropertyId="0:830"/><ViewModelInstanceNumber propertyValue="58" viewModelPropertyId="0:831"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:832"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:833"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:834"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:835"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:836"/><ViewModelInstanceNumber propertyValue="0.7" viewModelPropertyId="0:837"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:838"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:839"/>
  </ViewModelInstance>
</ViewModel>`;

const scene = `<Rive version="1" kind="fragment">
  <Artboard defaultStateMachineId="0:100" viewModelId="0:800" viewModelInstanceId="0:801" styleId="0:5" width="800" height="800" name="Foxy" id="0:1"><LayoutComponentStyle name="Foxy Artboard Style" id="0:5"/><Fill name="Background"><SolidColor colorValue="${C.bg}" name="Color"/></Fill>
    <Node x="400" y="525" name="CharacterRoot" id="0:180"><Node name="BodyControl" id="0:200"><DataBindContext sourcePathIds="0:800-0:815" propertyKey="14"/><DataBindContext sourcePathIds="0:800-0:816" propertyKey="15"/><Node name="BodyIdle" id="0:201">
      ${ellipse(0,245,236,30,'FF50352A','GroundShadow',450,{opacity:0.10})}
      ${tail}
      ${arm('Left',{node:290,upperBone:300,foreBone:301,shoulderCover:500,upperSkin:501,upperHighlight:502,elbowBlend:503,foreSkin:504,paw:505,pawBlend:506},-98,1.88,-0.9,280)}
      ${arm('Right',{node:291,upperBone:310,foreBone:311,shoulderCover:520,upperSkin:521,upperHighlight:522,elbowBlend:523,foreSkin:524,paw:525,pawBlend:526},98,1.26,0.9,281,true)}
      ${body}
      ${scarf}
      <Node x="0" y="-213" name="HeadAnchor" id="0:181"><Node name="HeadControl" id="0:210"><DataBindContext sourcePathIds="0:800-0:818" propertyKey="14"/><DataBindContext sourcePathIds="0:800-0:819" propertyKey="15"/><Node name="HeadIdle" id="0:211">
        ${ellipse(0,0,300,270,C.fur,'HeadBase',340,{stroke:3})}${ear('left',-96,-0.1,400)}${ear('right',96,0.1,404)}${ellipse(-47,-72,116,60,C.furLight,'ForeheadHighlight',408,{opacity:0.14})}${face}
      </Node></Node></Node>
      <Node x="-112" y="58" name="LeftHandTarget" id="0:280"><DataBindContext sourcePathIds="0:800-0:828" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:829" propertyKey="14"/></Node><Node x="112" y="58" name="RightHandTarget" id="0:281"><DataBindContext sourcePathIds="0:800-0:830" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:831" propertyKey="14"/></Node>
    </Node></Node></Node>
    <StateMachine name="FoxyMachine" id="0:100"><StateMachineLayer name="BodyAmbient" id="0:101"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState><StateTransition stateToId="0:103"/></EntryState><AnimationState x="200" animationId="0:90" id="0:103"/></StateMachineLayer><StateMachineLayer name="BlinkAmbient" id="0:104"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState><StateTransition stateToId="0:106"/></EntryState><AnimationState x="200" animationId="0:91" id="0:106"/></StateMachineLayer></StateMachine>
    <LinearAnimation loopValue="loop" duration="220" name="BreathAndDrift" id="0:90"><KeyedObject objectId="0:201"><KeyedProperty propertyKey="14"><KeyFrameDouble value="0" interpolationType="linear"/><KeyFrameDouble value="-2.4" interpolationType="linear" frame="110"/><KeyFrameDouble value="0" interpolationType="linear" frame="220"/></KeyedProperty></KeyedObject></LinearAnimation>
    <LinearAnimation loopValue="loop" duration="270" name="Blink" id="0:91"><KeyedObject objectId="0:220"><KeyedProperty propertyKey="17"><KeyFrameDouble value="1" interpolationType="linear"/><KeyFrameDouble value="1" interpolationType="linear" frame="178"/><KeyFrameDouble value="0.08" interpolationType="linear" frame="183"/><KeyFrameDouble value="1" interpolationType="linear" frame="190"/><KeyFrameDouble value="1" interpolationType="linear" frame="270"/></KeyedProperty></KeyedObject></LinearAnimation>
  </Artboard>${viewModel}</Rive>`;

const dir = new URL('../rive/foxy/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('scene.rml', dir), scene);
console.log('generated foxy v3 hidden-joint master');
