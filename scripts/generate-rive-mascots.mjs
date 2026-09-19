import { mkdir, writeFile } from 'node:fs/promises';

const ellipse = (x,y,w,h,color,name,id,stroke) =>
  `<Shape x="${x}" y="${y}" name="${name}" id="0:${id}"><Ellipse width="${w}" height="${h}" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="${color}" name="Color"/></Fill>${stroke ? `<Stroke thickness="${stroke[0]}" name="Outline"><SolidColor colorValue="${stroke[1]}" name="Color"/></Stroke>` : ''}</Shape>`;
const rect = (x,y,w,h,r,color,name,id,stroke) =>
  `<Shape x="${x}" y="${y}" name="${name}" id="0:${id}"><Rectangle width="${w}" height="${h}" originX="0.5" originY="0.5" cornerRadiusTL="${r}" cornerRadiusTR="${r}" cornerRadiusBL="${r}" cornerRadiusBR="${r}" name="Path"/><Fill name="Fill"><SolidColor colorValue="${color}" name="Color"/></Fill>${stroke ? `<Stroke thickness="${stroke[0]}" name="Outline"><SolidColor colorValue="${stroke[1]}" name="Color"/></Stroke>` : ''}</Shape>`;
const triangle = (x,y,w,h,rotation,color,name,id,stroke) =>
  `<Shape x="${x}" y="${y}" rotation="${rotation}" name="${name}" id="0:${id}"><Triangle originX="0.5" originY="0.5" width="${w}" height="${h}" name="Path"/><Fill name="Fill"><SolidColor colorValue="${color}" name="Color"/></Fill>${stroke ? `<Stroke thickness="${stroke[0]}" name="Outline"><SolidColor colorValue="${stroke[1]}" name="Color"/></Stroke>` : ''}</Shape>`;

const common = {
  bg:'FFFFFBF4', eyeW:58, eyeH:52, headW:270, headH:252,
  upperLen:92, foreLen:82, foreShapeX:88, armThickness:42, handW:50, handH:48,
  leftShoulderX:-118, rightShoulderX:118, shoulderY:-88,
  leftUpperRot:1.8, leftForeRot:-0.82, rightUpperRot:1.3415927, rightForeRot:0.82,
  breathY:-4,
};

const configs = {
  benny: {
    ...common, name:'Benny', skin:'FFB86B3D', outline:'FF4B2C1D', cheek:'FFFF8F86',
    armColor:'FFF7B72D', handColor:'FFB86B3D', headAnchorY:-272,
    leftTargetX:-146, rightTargetX:146, targetY:74,
    headDecor:[
      ellipse(-94,-92,74,74,'FF9A5B34','LeftEar',400,[4,'FF4B2C1D']),
      ellipse(-94,-92,42,42,'FFE7B19B','LeftInnerEar',401),
      ellipse(94,-92,74,74,'FF9A5B34','RightEar',402,[4,'FF4B2C1D']),
      ellipse(94,-92,42,42,'FFE7B19B','RightInnerEar',403),
      ellipse(-20,-122,18,24,'FF7A4428','Tuft1',404),
      ellipse(0,-128,18,28,'FF7A4428','Tuft2',405),
      ellipse(20,-122,18,24,'FF7A4428','Tuft3',406),
    ].join('\n'),
    facePatch: ellipse(0,55,112,78,'FFF5D8C7','Muzzle',410),
    nose: ellipse(0,35,28,20,'FF3B2318','Nose',411),
    behindBody:'',
    frontBody:[
      rect(0,35,288,300,72,'FFF7B72D','Hoodie',420,[5,'FF4B2C1D']),
      ellipse(0,90,112,86,'FFFFD468','HoodiePatch',421,[3,'FFE49B14']),
      rect(0,175,116,44,20,'FFE49B14','Pocket',422,[3,'FFB9780E']),
      ellipse(-62,194,70,58,'FF9A5B34','LeftFoot',423,[4,'FF4B2C1D']),
      ellipse(62,194,70,58,'FF9A5B34','RightFoot',424,[4,'FF4B2C1D']),
    ].join('\n'),
  },
  dino: {
    ...common, name:'Dino', skin:'FF71E055', outline:'FF236B37', cheek:'FFFFA7A2',
    armColor:'FF71E055', handColor:'FF5DCD49', headAnchorY:-270,
    leftTargetX:-126, rightTargetX:126, targetY:62,
    upperLen:78, foreLen:68, foreShapeX:74, armThickness:38, handW:44, handH:42,
    leftShoulderX:-112, rightShoulderX:112, shoulderY:-86, headW:258, headH:236, eyeW:60, eyeH:54, breathY:-5,
    headDecor:[
      triangle(-44,-124,52,64,-0.18,'FF36B85D','HeadSpike1',400,[3,'FF1B6C39']),
      triangle(8,-138,58,72,0,'FF2DB457','HeadSpike2',401,[3,'FF1B6C39']),
      triangle(62,-118,48,60,0.22,'FF27A94D','HeadSpike3',402,[3,'FF1B6C39']),
    ].join('\n'),
    facePatch:'',
    nose:[
      ellipse(-10,28,8,8,'FF235F35','NostrilL',410),
      ellipse(10,28,8,8,'FF235F35','NostrilR',411),
    ].join('\n'),
    behindBody:`<Shape x="138" y="92" rotation="0.3" name="Tail" id="0:430"><PointsPath isClosed="true" name="Path"><CubicMirroredVertex x="-58" y="-16" rotation="0" distance="25"/><CubicMirroredVertex x="20" y="-12" rotation="0.15" distance="28"/><CubicMirroredVertex x="88" y="24" rotation="0.4" distance="30"/><CubicMirroredVertex x="20" y="42" rotation="-0.2" distance="24"/><CubicMirroredVertex x="-55" y="24" rotation="0" distance="20"/></PointsPath><Fill name="Fill"><SolidColor colorValue="FF68D94F" name="Color"/></Fill><Stroke thickness="4" name="Outline"><SolidColor colorValue="FF236B37" name="Color"/></Stroke></Shape>`,
    frontBody:[
      ellipse(0,45,292,308,'FF71E055','Body',420,[5,'FF236B37']),
      ellipse(0,72,154,214,'FFFFD85D','Belly',421,[4,'FFE5B735']),
      ellipse(-62,196,78,58,'FF5DCD49','LeftFoot',423,[4,'FF236B37']),
      ellipse(62,196,78,58,'FF5DCD49','RightFoot',424,[4,'FF236B37']),
      triangle(120,-16,40,52,0.4,'FF2EA94A','BackSpike1',425,[3,'FF1B6C39']),
      triangle(132,38,38,48,0.65,'FF2EA94A','BackSpike2',426,[3,'FF1B6C39']),
      triangle(130,92,34,44,0.85,'FF2EA94A','BackSpike3',427,[3,'FF1B6C39']),
    ].join('\n'),
  },
  foxy: {
    ...common, name:'Foxy', skin:'FFF48332', outline:'FF6B321B', cheek:'FFFFA29C',
    armColor:'FFF48332', handColor:'FF8D431F', headAnchorY:-274,
    leftTargetX:-142, rightTargetX:142, targetY:70,
    headW:264, headH:228, eyeW:56, eyeH:50, breathY:-3.5,
    headDecor:[
      triangle(-88,-112,92,120,-0.18,'FFF48332','LeftEar',400,[5,'FF6B321B']),
      triangle(-88,-106,48,66,-0.18,'FFFFD4B6','LeftInnerEar',401),
      triangle(88,-112,92,120,0.18,'FFF48332','RightEar',402,[5,'FF6B321B']),
      triangle(88,-106,48,66,0.18,'FFFFD4B6','RightInnerEar',403),
    ].join('\n'),
    facePatch:[
      ellipse(-50,48,118,92,'FFFFE2CF','LeftMuzzle',410),
      ellipse(50,48,118,92,'FFFFE2CF','RightMuzzle',411),
    ].join('\n'),
    nose: ellipse(0,35,26,18,'FF3B2117','Nose',412),
    behindBody:`<Shape x="130" y="108" rotation="0.22" name="Tail" id="0:430"><PointsPath isClosed="true" name="Path"><CubicMirroredVertex x="-60" y="-20" rotation="0" distance="24"/><CubicMirroredVertex x="8" y="-54" rotation="0.2" distance="34"/><CubicMirroredVertex x="92" y="-18" rotation="0.55" distance="34"/><CubicMirroredVertex x="55" y="50" rotation="-0.35" distance="34"/><CubicMirroredVertex x="-44" y="40" rotation="0" distance="28"/></PointsPath><Fill name="Fill"><SolidColor colorValue="FFF48332" name="Color"/></Fill><Stroke thickness="4" name="Outline"><SolidColor colorValue="FF6B321B" name="Color"/></Stroke></Shape><Shape x="201" y="100" rotation="0.22" name="TailTip" id="0:431"><Ellipse width="78" height="68" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFE2CF" name="Color"/></Fill></Shape>`,
    frontBody:[
      ellipse(0,48,270,300,'FFF48332','Body',420,[5,'FF6B321B']),
      ellipse(0,88,128,192,'FFFFE2CF','Chest',421,[3,'FFE9B99F']),
      rect(0,-52,232,46,18,'FF2E73C8','ScarfBand',422,[3,'FF1E4E8E']),
      triangle(26,-14,72,66,0.15,'FF2E73C8','ScarfTail',425,[3,'FF1E4E8E']),
      ellipse(-58,198,68,54,'FF8D431F','LeftFoot',423,[4,'FF6B321B']),
      ellipse(58,198,68,54,'FF8D431F','RightFoot',424,[4,'FF6B321B']),
    ].join('\n'),
  },
};

function arm(c, side, nodeId, upperId, foreId, handId, foreShapeId, upperShapeId, x, upperRot, foreRot, targetId, invert=false) {
  const upperBinding = side === 'Left' ? 820 : 822;
  const foreBinding = side === 'Left' ? 821 : 823;
  return `<Node x="${x}" y="${c.shoulderY}" name="${side}ShoulderIdle" id="0:${nodeId}"><RootBone x="0" y="0" length="${c.upperLen}" rotation="${upperRot}" name="${side}UpperBone" id="0:${upperId}"><DataBindContext sourcePathIds="0:800-0:${upperBinding}" propertyKey="15"/><Bone length="${c.foreLen}" rotation="${foreRot}" name="${side}ForeBone" id="0:${foreId}"><DataBindContext sourcePathIds="0:800-0:${foreBinding}" propertyKey="15"/><IKConstraint targetId="0:${targetId}" parentBoneCount="1" ${invert?'invertDirection="true" ':''}strength="1" name="${side}HandIK"><DataBindContext sourcePathIds="0:800-0:832" propertyKey="172"/></IKConstraint>${ellipse(c.foreShapeX,0,c.handW,c.handH,c.handColor,`${side}Hand`,handId,[4,c.outline])}${rect(c.foreLen/2,0,c.foreLen,c.armThickness,c.armThickness/2,c.armColor,`${side}Forearm`,foreShapeId,[4,c.outline])}</Bone>${rect(c.upperLen/2,0,c.upperLen,c.armThickness+4,(c.armThickness+4)/2,c.armColor,`${side}UpperArm`,upperShapeId,[4,c.outline])}</RootBone></Node>`;
}

function viewModel(c) {
  return `<DataConverterRangeMapper minInput="0" maxInput="1" minOutput="42" maxOutput="90" clampLower="true" clampUpper="true" name="MouthWidthPixels" id="0:700"/><DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-11" maxOutput="11" clampLower="true" clampUpper="true" name="GazeXToPixels" id="0:701"/><DataConverterRangeMapper minInput="-1" maxInput="1" minOutput="-8" maxOutput="8" clampLower="true" clampUpper="true" name="GazeYToPixels" id="0:702"/>
<ViewModel defaultInstanceId="0:801" name="${c.name}VM" id="0:800"><ViewModelPropertyBoolean name="speaking" id="0:802"/><ViewModelPropertyNumber name="gazeX" id="0:803"/><ViewModelPropertyNumber name="gazeY" id="0:804"/><ViewModelPropertyNumber name="mouthOpen" id="0:805"/><ViewModelPropertyNumber name="mouthWidth" id="0:806"/><ViewModelPropertyNumber name="mouthRound" id="0:807"/><ViewModelPropertyNumber name="speechEnergy" id="0:808"/><ViewModelPropertyNumber name="lipPress" id="0:809"/><ViewModelPropertyNumber name="lowerLipBite" id="0:810"/><ViewModelPropertyNumber name="teeth" id="0:811"/><ViewModelPropertyNumber name="tongue" id="0:812"/><ViewModelPropertyNumber name="cornerPull" id="0:813"/><ViewModelPropertyNumber name="bodyX" id="0:814"/><ViewModelPropertyNumber name="bodyY" id="0:815"/><ViewModelPropertyNumber name="bodyLean" id="0:816"/><ViewModelPropertyNumber name="headX" id="0:817"/><ViewModelPropertyNumber name="headY" id="0:818"/><ViewModelPropertyNumber name="headTilt" id="0:819"/><ViewModelPropertyNumber name="leftShoulder" id="0:820"/><ViewModelPropertyNumber name="leftElbow" id="0:821"/><ViewModelPropertyNumber name="rightShoulder" id="0:822"/><ViewModelPropertyNumber name="rightElbow" id="0:823"/><ViewModelPropertyNumber name="eyeScale" id="0:824"/><ViewModelPropertyNumber name="browY" id="0:825"/><ViewModelPropertyNumber name="smileOpacity" id="0:826"/><ViewModelPropertyNumber name="neutralOpacity" id="0:827"/><ViewModelPropertyNumber name="leftHandX" id="0:828"/><ViewModelPropertyNumber name="leftHandY" id="0:829"/><ViewModelPropertyNumber name="rightHandX" id="0:830"/><ViewModelPropertyNumber name="rightHandY" id="0:831"/><ViewModelPropertyNumber name="ikStrength" id="0:832"/>
<ViewModelInstance exports="true" name="Default" id="0:801"><ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="0:802"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:803"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:804"/><ViewModelInstanceNumber propertyValue="0.06" viewModelPropertyId="0:805"/><ViewModelInstanceNumber propertyValue="0.4" viewModelPropertyId="0:806"/><ViewModelInstanceNumber propertyValue="0.06" viewModelPropertyId="0:807"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:808"/><ViewModelInstanceNumber propertyValue="0.08" viewModelPropertyId="0:809"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:810"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:811"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:812"/><ViewModelInstanceNumber propertyValue="0.1" viewModelPropertyId="0:813"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:814"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:815"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:816"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:817"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:818"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:819"/><ViewModelInstanceNumber propertyValue="${c.leftUpperRot}" viewModelPropertyId="0:820"/><ViewModelInstanceNumber propertyValue="${c.leftForeRot}" viewModelPropertyId="0:821"/><ViewModelInstanceNumber propertyValue="${c.rightUpperRot}" viewModelPropertyId="0:822"/><ViewModelInstanceNumber propertyValue="${c.rightForeRot}" viewModelPropertyId="0:823"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:824"/><ViewModelInstanceNumber propertyValue="-52" viewModelPropertyId="0:825"/><ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:826"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:827"/><ViewModelInstanceNumber propertyValue="${c.leftTargetX}" viewModelPropertyId="0:828"/><ViewModelInstanceNumber propertyValue="${c.targetY}" viewModelPropertyId="0:829"/><ViewModelInstanceNumber propertyValue="${c.rightTargetX}" viewModelPropertyId="0:830"/><ViewModelInstanceNumber propertyValue="${c.targetY}" viewModelPropertyId="0:831"/><ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="0:832"/></ViewModelInstance></ViewModel>`;
}

function scene(c) {
  const dark = c.outline;
  return `<Rive version="1" kind="fragment">
  <Artboard defaultStateMachineId="0:100" viewModelId="0:800" viewModelInstanceId="0:801" styleId="0:5" width="800" height="800" name="${c.name}" id="0:1">
    <LayoutComponentStyle name="${c.name} Artboard Style" id="0:5"/>
    <Fill name="Background"><SolidColor colorValue="${c.bg}" name="Color"/></Fill>
    <Node x="400" y="535" name="CharacterRoot" id="0:180"><Node x="0" y="0" name="BodyControl" id="0:200"><DataBindContext sourcePathIds="0:800-0:815" propertyKey="14"/><DataBindContext sourcePathIds="0:800-0:816" propertyKey="15"/><Node x="0" y="0" name="BodyIdle" id="0:201">
      ${c.behindBody}
      <Node x="0" y="${c.headAnchorY}" name="HeadAnchor" id="0:181"><Node x="0" y="0" name="HeadControl" id="0:210"><DataBindContext sourcePathIds="0:800-0:818" propertyKey="14"/><DataBindContext sourcePathIds="0:800-0:819" propertyKey="15"/><Node x="0" y="0" name="HeadIdle" id="0:211">
        ${c.headDecor}
        <Node x="0" y="0" name="EyeAuto" id="0:220"><Node x="0" y="0" name="EyeManual" id="0:221"><DataBindContext sourcePathIds="0:800-0:824" propertyKey="17"/><Node x="-52" y="-8" name="LeftEyeSocket" id="0:222"><Node x="0" y="0" name="LeftPupilControl" id="0:224"><DataBindContext sourcePathIds="0:800-0:803" propertyKey="13" converterId="0:701"/><DataBindContext sourcePathIds="0:800-0:804" propertyKey="14" converterId="0:702"/>${ellipse(0,0,24,29,dark,'LeftPupil',352)}</Node>${ellipse(0,0,c.eyeW,c.eyeH,'FFFFFFFF','LeftEyeWhite',350,[3.5,dark])}</Node><Node x="52" y="-8" name="RightEyeSocket" id="0:223"><Node x="0" y="0" name="RightPupilControl" id="0:225"><DataBindContext sourcePathIds="0:800-0:803" propertyKey="13" converterId="0:701"/><DataBindContext sourcePathIds="0:800-0:804" propertyKey="14" converterId="0:702"/>${ellipse(0,0,24,29,dark,'RightPupil',353)}</Node>${ellipse(0,0,c.eyeW,c.eyeH,'FFFFFFFF','RightEyeWhite',351,[3.5,dark])}</Node></Node></Node>
        <Node x="0" y="-54" name="Brows" id="0:226"><DataBindContext sourcePathIds="0:800-0:825" propertyKey="14"/><Shape x="-52" y="0" rotation="-0.05" name="LeftBrow" id="0:354"><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-22" y="3" rotation="0.06" distance="11"/><CubicMirroredVertex x="0" y="-3" rotation="0" distance="11"/><CubicMirroredVertex x="22" y="3" rotation="-0.06" distance="11"/></PointsPath><Stroke thickness="5.5" cap="round" join="round" name="Stroke"><SolidColor colorValue="${dark}" name="Color"/></Stroke></Shape><Shape x="52" y="0" rotation="0.05" name="RightBrow" id="0:355"><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-22" y="3" rotation="0.06" distance="11"/><CubicMirroredVertex x="0" y="-3" rotation="0" distance="11"/><CubicMirroredVertex x="22" y="3" rotation="-0.06" distance="11"/></PointsPath><Stroke thickness="5.5" cap="round" join="round" name="Stroke"><SolidColor colorValue="${dark}" name="Color"/></Stroke></Shape></Node>
        ${ellipse(-78,36,34,22,c.cheek,'LeftCheek',356)}${ellipse(78,36,34,22,c.cheek,'RightCheek',357)}${c.facePatch}
        <Shape x="0" y="62" opacity="0" name="SmileMouth" id="0:360"><DataBindContext sourcePathIds="0:800-0:826" propertyKey="18"/><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-34" y="-1" rotation="0.34" distance="17"/><CubicMirroredVertex x="0" y="14" rotation="0" distance="20"/><CubicMirroredVertex x="34" y="-1" rotation="-0.34" distance="17"/></PointsPath><Stroke thickness="5.5" cap="round" join="round" name="Stroke"><SolidColor colorValue="${dark}" name="Color"/></Stroke></Shape><Shape x="0" y="61" opacity="1" name="NeutralMouth" id="0:361"><DataBindContext sourcePathIds="0:800-0:827" propertyKey="18"/><PointsPath isClosed="false" name="Path"><CubicMirroredVertex x="-26" y="1" rotation="0.08" distance="12"/><CubicMirroredVertex x="0" y="4" rotation="0" distance="13"/><CubicMirroredVertex x="26" y="1" rotation="-0.08" distance="12"/></PointsPath><Stroke thickness="4.5" cap="round" join="round" name="Stroke"><SolidColor colorValue="${dark}" name="Color"/></Stroke></Shape>
        <Shape x="0" y="52" opacity="0" name="Teeth" id="0:365"><DataBindContext sourcePathIds="0:800-0:811" propertyKey="18"/><Rectangle width="44" height="11" originX="0.5" originY="0.5" cornerRadiusTL="5" cornerRadiusTR="5" cornerRadiusBL="5" cornerRadiusBR="5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFFFFFFF" name="Color"/></Fill></Shape><Shape x="0" y="77" opacity="0" name="Tongue" id="0:366"><DataBindContext sourcePathIds="0:800-0:812" propertyKey="18"/><Ellipse width="38" height="15" originX="0.5" originY="0.5" name="Path"/><Fill name="Fill"><SolidColor colorValue="FFF08A96" name="Color"/></Fill></Shape><Shape x="0" y="64" scaleY="0.06" name="OpenMouth" id="0:362"><DataBindContext sourcePathIds="0:800-0:805" propertyKey="17"/><Ellipse width="62" height="52" originX="0.5" originY="0.5" name="Path" id="0:364"><DataBindContext sourcePathIds="0:800-0:806" propertyKey="20" converterId="0:700"/></Ellipse><Fill name="Fill"><SolidColor colorValue="${dark}" name="Color"/></Fill></Shape>${c.nose}${ellipse(0,0,c.headW,c.headH,c.skin,'HeadBase',370,[5,dark])}
      </Node></Node></Node>
      <Node x="${c.leftTargetX}" y="${c.targetY}" name="LeftHandTarget" id="0:280"><DataBindContext sourcePathIds="0:800-0:828" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:829" propertyKey="14"/></Node><Node x="${c.rightTargetX}" y="${c.targetY}" name="RightHandTarget" id="0:281"><DataBindContext sourcePathIds="0:800-0:830" propertyKey="13"/><DataBindContext sourcePathIds="0:800-0:831" propertyKey="14"/></Node>
      ${arm(c,'Left',290,300,301,340,330,332,c.leftShoulderX,c.leftUpperRot,c.leftForeRot,280)}${arm(c,'Right',291,310,311,341,331,333,c.rightShoulderX,c.rightUpperRot,c.rightForeRot,281,true)}${c.frontBody}
    </Node></Node></Node>
    <StateMachine name="${c.name}Machine" id="0:100"><StateMachineLayer name="BodyAmbient" id="0:101"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState><StateTransition stateToId="0:103"/></EntryState><AnimationState x="200" animationId="0:90" id="0:103"/></StateMachineLayer><StateMachineLayer name="BlinkAmbient" id="0:104"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState><StateTransition stateToId="0:106"/></EntryState><AnimationState x="200" animationId="0:91" id="0:106"/></StateMachineLayer></StateMachine>
    <LinearAnimation loopValue="loop" duration="180" name="BreathAndDrift" id="0:90"><KeyedObject objectId="0:201"><KeyedProperty propertyKey="14"><KeyFrameDouble value="0" interpolationType="linear"/><KeyFrameDouble value="${c.breathY}" interpolationType="linear" frame="90"/><KeyFrameDouble value="0" interpolationType="linear" frame="180"/></KeyedProperty><KeyedProperty propertyKey="15"><KeyFrameDouble value="-0.004" interpolationType="linear"/><KeyFrameDouble value="0.004" interpolationType="linear" frame="90"/><KeyFrameDouble value="-0.004" interpolationType="linear" frame="180"/></KeyedProperty></KeyedObject><KeyedObject objectId="0:211"><KeyedProperty propertyKey="14"><KeyFrameDouble value="0" interpolationType="linear"/><KeyFrameDouble value="-2" interpolationType="linear" frame="90"/><KeyFrameDouble value="0" interpolationType="linear" frame="180"/></KeyedProperty></KeyedObject></LinearAnimation><LinearAnimation loopValue="loop" duration="240" name="Blink" id="0:91"><KeyedObject objectId="0:220"><KeyedProperty propertyKey="17"><KeyFrameDouble value="1" interpolationType="linear"/><KeyFrameDouble value="1" interpolationType="linear" frame="152"/><KeyFrameDouble value="0.08" interpolationType="linear" frame="157"/><KeyFrameDouble value="1" interpolationType="linear" frame="164"/><KeyFrameDouble value="1" interpolationType="linear" frame="240"/></KeyedProperty></KeyedObject></LinearAnimation>
  </Artboard>${viewModel(c)}</Rive>`;
}

for (const [id, config] of Object.entries(configs)) {
  const dir = new URL(`../rive/${id}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('scene.rml', dir), scene(config));
  console.log(`generated ${id}`);
}
