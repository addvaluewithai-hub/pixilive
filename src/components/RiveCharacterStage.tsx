import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
} from '@rive-app/react-webgl2';
import { useEffect, useRef, useState } from 'react';
import type { CharacterDefinition } from '../character/runtime';
import type { Emotion, MouthPose } from '../character/types';

interface RiveCharacterStageProps {
  character: CharacterDefinition;
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
}

type RigState = {
  bodyX: number;
  bodyY: number;
  bodyLean: number;
  headX: number;
  headY: number;
  headTilt: number;
  leftShoulder: number;
  leftElbow: number;
  rightShoulder: number;
  rightElbow: number;
  eyeScale: number;
  browY: number;
  smileOpacity: number;
  neutralOpacity: number;
};

const defaultRig: RigState = {
  bodyX: 0,
  bodyY: 0,
  bodyLean: 0,
  headX: 0,
  headY: 0,
  headTilt: 0,
  leftShoulder: 1.72,
  leftElbow: -0.78,
  rightShoulder: 1.4215927,
  rightElbow: 0.78,
  eyeScale: 1,
  browY: -55,
  smileOpacity: 0,
  neutralOpacity: 1,
};

const emotionFace: Record<Emotion, Partial<RigState>> = {
  calm: { eyeScale: 1, browY: -55, smileOpacity: 0.05, neutralOpacity: 1, headTilt: 0 },
  happy: { eyeScale: 0.82, browY: -62, smileOpacity: 1, neutralOpacity: 0, headTilt: 0.035 },
  curious: { eyeScale: 1.08, browY: -64, smileOpacity: 0.16, neutralOpacity: 0.95, headTilt: -0.12 },
  excited: { eyeScale: 1.14, browY: -66, smileOpacity: 1, neutralOpacity: 0, headTilt: 0.065 },
};

interface RigSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function RigSlider({ label, value, min, max, step, onChange }: RigSliderProps) {
  return (
    <label className="rig-slider">
      <span>{label}<b>{value.toFixed(step < 0.1 ? 2 : 1)}</b></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function RiveCharacterStage({ character, emotion, mouth, speaking }: RiveCharacterStageProps) {
  const source = character.rive;
  if (!source) throw new Error(`${character.name} is missing its Rive source configuration.`);

  const { rive, RiveComponent } = useRive({
    src: source.src,
    artboard: source.artboard,
    stateMachine: source.stateMachine,
    autoplay: true,
    autoBind: true,
  });

  const viewModelInstance = rive?.viewModelInstance;
  const [rig, setRig] = useState<RigState>(defaultRig);
  const [labOpen, setLabOpen] = useState(true);
  const [motionSweep, setMotionSweep] = useState(false);
  const reactionTimer = useRef<number | null>(null);

  const { setValue: setSpeaking } = useViewModelInstanceBoolean('speaking', viewModelInstance);
  const { setValue: setGazeX } = useViewModelInstanceNumber('gazeX', viewModelInstance);
  const { setValue: setGazeY } = useViewModelInstanceNumber('gazeY', viewModelInstance);
  const { setValue: setMouthOpen } = useViewModelInstanceNumber('mouthOpen', viewModelInstance);
  const { setValue: setMouthWidth } = useViewModelInstanceNumber('mouthWidth', viewModelInstance);
  const { setValue: setMouthRound } = useViewModelInstanceNumber('mouthRound', viewModelInstance);
  const { setValue: setSpeechEnergy } = useViewModelInstanceNumber('speechEnergy', viewModelInstance);
  const { setValue: setLipPress } = useViewModelInstanceNumber('lipPress', viewModelInstance);
  const { setValue: setLowerLipBite } = useViewModelInstanceNumber('lowerLipBite', viewModelInstance);
  const { setValue: setTeeth } = useViewModelInstanceNumber('teeth', viewModelInstance);
  const { setValue: setTongue } = useViewModelInstanceNumber('tongue', viewModelInstance);
  const { setValue: setCornerPull } = useViewModelInstanceNumber('cornerPull', viewModelInstance);

  const { setValue: setBodyX } = useViewModelInstanceNumber('bodyX', viewModelInstance);
  const { setValue: setBodyY } = useViewModelInstanceNumber('bodyY', viewModelInstance);
  const { setValue: setBodyLean } = useViewModelInstanceNumber('bodyLean', viewModelInstance);
  const { setValue: setHeadX } = useViewModelInstanceNumber('headX', viewModelInstance);
  const { setValue: setHeadY } = useViewModelInstanceNumber('headY', viewModelInstance);
  const { setValue: setHeadTilt } = useViewModelInstanceNumber('headTilt', viewModelInstance);
  const { setValue: setLeftShoulder } = useViewModelInstanceNumber('leftShoulder', viewModelInstance);
  const { setValue: setLeftElbow } = useViewModelInstanceNumber('leftElbow', viewModelInstance);
  const { setValue: setRightShoulder } = useViewModelInstanceNumber('rightShoulder', viewModelInstance);
  const { setValue: setRightElbow } = useViewModelInstanceNumber('rightElbow', viewModelInstance);
  const { setValue: setEyeScale } = useViewModelInstanceNumber('eyeScale', viewModelInstance);
  const { setValue: setBrowY } = useViewModelInstanceNumber('browY', viewModelInstance);
  const { setValue: setSmileOpacity } = useViewModelInstanceNumber('smileOpacity', viewModelInstance);
  const { setValue: setNeutralOpacity } = useViewModelInstanceNumber('neutralOpacity', viewModelInstance);

  const applyRig = (next: RigState) => {
    setBodyX(next.bodyX);
    setBodyY(next.bodyY);
    setBodyLean(next.bodyLean);
    setHeadX(next.headX);
    setHeadY(next.headY);
    setHeadTilt(next.headTilt);
    setLeftShoulder(next.leftShoulder);
    setLeftElbow(next.leftElbow);
    setRightShoulder(next.rightShoulder);
    setRightElbow(next.rightElbow);
    setEyeScale(next.eyeScale);
    setBrowY(next.browY);
    setSmileOpacity(speaking ? 0 : next.smileOpacity);
    setNeutralOpacity(speaking ? 0 : next.neutralOpacity);
  };

  const updateRig = (key: keyof RigState, value: number) => {
    const next = { ...rig, [key]: value };
    setRig(next);
    applyRig(next);
  };

  const patchRig = (patch: Partial<RigState>) => {
    const next = { ...rig, ...patch };
    setRig(next);
    applyRig(next);
  };

  useEffect(() => {
    applyRig(rig);
    // Re-apply the authored pose after the Rive ViewModel instance becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModelInstance]);

  useEffect(() => {
    const face = emotionFace[emotion];
    setRig((current) => ({ ...current, ...face }));
    if (face.eyeScale !== undefined) setEyeScale(face.eyeScale);
    if (face.browY !== undefined) setBrowY(face.browY);
    if (face.smileOpacity !== undefined) setSmileOpacity(speaking ? 0 : face.smileOpacity);
    if (face.neutralOpacity !== undefined) setNeutralOpacity(speaking ? 0 : face.neutralOpacity);
    if (face.headTilt !== undefined) setHeadTilt(face.headTilt);
  }, [emotion, setBrowY, setEyeScale, setHeadTilt, setNeutralOpacity, setSmileOpacity, speaking]);

  useEffect(() => {
    setSpeaking(speaking);
    setMouthOpen(speaking ? mouth.open : 0.035);
    setMouthWidth(speaking ? mouth.width : 0.4);
    setMouthRound(speaking ? mouth.round : 0.06);
    setSpeechEnergy(speaking ? mouth.energy : 0);
    setLipPress(speaking ? (mouth.lipPress ?? 0) : 0.08);
    setLowerLipBite(speaking ? (mouth.lowerLipBite ?? 0) : 0);
    setTeeth(speaking ? (mouth.teeth ?? 0) : 0);
    setTongue(speaking ? (mouth.tongue ?? 0) : 0);
    setCornerPull(speaking ? (mouth.cornerPull ?? 0.1) : 0.1);
    setSmileOpacity(speaking ? 0 : rig.smileOpacity);
    setNeutralOpacity(speaking ? 0 : rig.neutralOpacity);
  }, [
    mouth,
    rig.neutralOpacity,
    rig.smileOpacity,
    setCornerPull,
    setLipPress,
    setLowerLipBite,
    setMouthOpen,
    setMouthRound,
    setMouthWidth,
    setNeutralOpacity,
    setSmileOpacity,
    setSpeaking,
    setSpeechEnergy,
    setTeeth,
    setTongue,
    speaking,
  ]);

  useEffect(() => {
    if (!motionSweep || !viewModelInstance) return;

    const base = rig;
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = (now - started) / 1000;
      setBodyY(base.bodyY + Math.sin(t * 1.4) * 3);
      setBodyLean(base.bodyLean + Math.sin(t * 0.8) * 0.035);
      setHeadTilt(base.headTilt + Math.sin(t * 1.1 + 0.5) * 0.08);
      setLeftShoulder(base.leftShoulder + Math.sin(t * 0.9) * 0.18);
      setRightShoulder(base.rightShoulder - Math.sin(t * 0.9) * 0.18);
      setLeftElbow(base.leftElbow + Math.sin(t * 1.2 + 1) * 0.2);
      setRightElbow(base.rightElbow - Math.sin(t * 1.2 + 1) * 0.2);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      applyRig(base);
    };
    // Motion sweep deliberately snapshots the current pose when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionSweep, viewModelInstance]);

  useEffect(() => () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current);
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.44) * 2;
    setGazeX(Math.max(-1, Math.min(1, x)));
    setGazeY(Math.max(-1, Math.min(1, y)));
  };

  const react = () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current);
    setBodyY(rig.bodyY - 10);
    setHeadY(rig.headY - 5);
    setHeadTilt(rig.headTilt + 0.09);
    reactionTimer.current = window.setTimeout(() => {
      applyRig(rig);
      reactionTimer.current = null;
    }, 170);
  };

  return (
    <div
      className="character-stage rive-character-stage"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setGazeX(0);
        setGazeY(0);
      }}
      onPointerDown={react}
      aria-label={`${character.name} animated Rive character`}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />

      <section
        className={`rive-motion-lab ${labOpen ? 'open' : ''}`}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Rive motion playground"
      >
        <button className="motion-lab-toggle" type="button" onClick={() => setLabOpen((value) => !value)}>
          <span><i /> Motion lab</span>
          <b>{labOpen ? 'hide' : 'show'}</b>
        </button>

        {labOpen && (
          <div className="motion-lab-body">
            <div className="motion-lab-actions">
              <button type="button" className={motionSweep ? 'active' : ''} onClick={() => setMotionSweep((value) => !value)}>
                {motionSweep ? 'Stop motion sweep' : 'Run motion sweep'}
              </button>
              <button type="button" onClick={() => patchRig(defaultRig)}>Reset rig</button>
            </div>

            <div className="rig-grid">
              <RigSlider label="Body lean" value={rig.bodyLean} min={-0.18} max={0.18} step={0.01} onChange={(value) => updateRig('bodyLean', value)} />
              <RigSlider label="Head tilt" value={rig.headTilt} min={-0.3} max={0.3} step={0.01} onChange={(value) => updateRig('headTilt', value)} />
              <RigSlider label="Head X" value={rig.headX} min={-35} max={35} step={1} onChange={(value) => updateRig('headX', value)} />
              <RigSlider label="Head Y" value={rig.headY} min={-25} max={25} step={1} onChange={(value) => updateRig('headY', value)} />
              <RigSlider label="L shoulder" value={rig.leftShoulder} min={1.05} max={2.35} step={0.01} onChange={(value) => updateRig('leftShoulder', value)} />
              <RigSlider label="L elbow" value={rig.leftElbow} min={-1.65} max={0.2} step={0.01} onChange={(value) => updateRig('leftElbow', value)} />
              <RigSlider label="R shoulder" value={rig.rightShoulder} min={0.8} max={2.1} step={0.01} onChange={(value) => updateRig('rightShoulder', value)} />
              <RigSlider label="R elbow" value={rig.rightElbow} min={-0.2} max={1.65} step={0.01} onChange={(value) => updateRig('rightElbow', value)} />
              <RigSlider label="Eye openness" value={rig.eyeScale} min={0.5} max={1.2} step={0.01} onChange={(value) => updateRig('eyeScale', value)} />
              <RigSlider label="Brow height" value={rig.browY} min={-74} max={-42} step={1} onChange={(value) => updateRig('browY', value)} />
            </div>

            <p className="motion-lab-note">Move the pointer for gaze. Click the character for a recoil test. The arm sliders drive real Rive bone joints, so broken shoulder/elbow behavior is easy to spot.</p>
          </div>
        )}
      </section>
    </div>
  );
}