import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
} from '@rive-app/react-webgl2';
import { useEffect, useRef, useState } from 'react';
import {
  createAgentMotionState,
  inferAgentGesture,
  stepAgentMotion,
  type AgentGesture,
} from '../character/agentMotion';
import type { CharacterDefinition } from '../character/runtime';
import type { Emotion, MouthPose } from '../character/types';

interface RiveCharacterStageProps {
  character: CharacterDefinition;
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
  speechText: string;
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
  leftHandX: number;
  leftHandY: number;
  rightHandX: number;
  rightHandY: number;
  ikStrength: number;
  eyeScale: number;
  browY: number;
  smileOpacity: number;
  neutralOpacity: number;
};

type AutoPose = Pick<
  RigState,
  'bodyY' | 'bodyLean' | 'headY' | 'headTilt' | 'leftHandX' | 'leftHandY' | 'rightHandX' | 'rightHandY'
>;

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
  leftHandX: -70,
  leftHandY: 116,
  rightHandX: 70,
  rightHandY: 116,
  ikStrength: 1,
  eyeScale: 0.92,
  browY: -53,
  smileOpacity: 0,
  neutralOpacity: 1,
};

const zeroAutoPose: AutoPose = {
  bodyY: 0,
  bodyLean: 0,
  headY: 0,
  headTilt: 0,
  leftHandX: 0,
  leftHandY: 0,
  rightHandX: 0,
  rightHandY: 0,
};

const emotionFace: Record<Emotion, Partial<RigState>> = {
  calm: { eyeScale: 0.92, browY: -53, smileOpacity: 0.04, neutralOpacity: 1, headTilt: 0 },
  happy: { eyeScale: 0.76, browY: -60, smileOpacity: 1, neutralOpacity: 0, headTilt: 0.045 },
  curious: { eyeScale: 1.02, browY: -63, smileOpacity: 0.18, neutralOpacity: 0.9, headTilt: -0.13 },
  excited: { eyeScale: 1.08, browY: -66, smileOpacity: 1, neutralOpacity: 0, headTilt: 0.075 },
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

const smoothToward = (current: number, target: number, response: number, dt: number) => {
  const alpha = 1 - Math.exp(-Math.min(0.05, dt) * response);
  return current + (target - current) * alpha;
};

export function RiveCharacterStage({ character, emotion, mouth, speaking, speechText }: RiveCharacterStageProps) {
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
  const bindingsReady = Boolean(viewModelInstance);
  const [rig, setRig] = useState<RigState>(defaultRig);
  const [labOpen, setLabOpen] = useState(false);
  const [motionSweep, setMotionSweep] = useState(false);
  const [agentMotionEnabled, setAgentMotionEnabled] = useState(true);
  const [gestureStrength, setGestureStrength] = useState(1);
  const [agentGesture, setAgentGesture] = useState<AgentGesture>('conversational');
  const reactionTimer = useRef<number | null>(null);
  const reactionStartedAt = useRef(-10_000);
  const rigRef = useRef<RigState>(defaultRig);
  const autoPoseRef = useRef<AutoPose>({ ...zeroAutoPose });
  const agentMotionStateRef = useRef(createAgentMotionState());
  const gestureRef = useRef<AgentGesture>('conversational');
  const speechRef = useRef({ speaking, energy: mouth.energy, emotion, text: speechText, strength: gestureStrength });

  rigRef.current = rig;
  speechRef.current = { speaking, energy: mouth.energy, emotion, text: speechText, strength: gestureStrength };

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
  const { setValue: setLeftHandX } = useViewModelInstanceNumber('leftHandX', viewModelInstance);
  const { setValue: setLeftHandY } = useViewModelInstanceNumber('leftHandY', viewModelInstance);
  const { setValue: setRightHandX } = useViewModelInstanceNumber('rightHandX', viewModelInstance);
  const { setValue: setRightHandY } = useViewModelInstanceNumber('rightHandY', viewModelInstance);
  const { setValue: setIkStrength } = useViewModelInstanceNumber('ikStrength', viewModelInstance);
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
    setLeftHandX(next.leftHandX);
    setLeftHandY(next.leftHandY);
    setRightHandX(next.rightHandX);
    setRightHandY(next.rightHandY);
    setIkStrength(next.ikStrength);
    setEyeScale(next.eyeScale);
    setBrowY(next.browY);
    setSmileOpacity(speaking ? 0 : next.smileOpacity);
    setNeutralOpacity(speaking ? 0 : next.neutralOpacity);
  };

  const updateRig = (key: keyof RigState, value: number) => {
    const next = { ...rig, [key]: value };
    setRig(next);
    rigRef.current = next;
    applyRig(next);
  };

  const patchRig = (patch: Partial<RigState>) => {
    const next = { ...rig, ...patch };
    setRig(next);
    rigRef.current = next;
    applyRig(next);
  };

  useEffect(() => {
    applyRig(rigRef.current);
    // Re-apply the authored pose after the Rive ViewModel instance becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModelInstance]);

  useEffect(() => {
    const face = emotionFace[emotion];
    setRig((current) => {
      const next = { ...current, ...face };
      rigRef.current = next;
      return next;
    });
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
    if (!viewModelInstance || !agentMotionEnabled || motionSweep) return;

    agentMotionStateRef.current = createAgentMotionState();
    autoPoseRef.current = { ...zeroAutoPose };
    let previousTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;
      const speech = speechRef.current;
      const base = rigRef.current;
      const target = stepAgentMotion(
        {
          nowMs: now,
          dtSeconds: dt,
          speaking: speech.speaking,
          energy: speech.energy,
          emotion: speech.emotion,
          text: speech.text,
          strength: speech.strength,
        },
        agentMotionStateRef.current,
      );

      const reactionAge = now - reactionStartedAt.current;
      const reactionProgress = Math.max(0, Math.min(1, reactionAge / 260));
      const reactionPulse = reactionAge >= 0 && reactionProgress < 1 ? Math.sin(Math.PI * reactionProgress) : 0;
      target.bodyY -= 8 * reactionPulse;
      target.headY -= 4 * reactionPulse;
      target.headTilt += 0.065 * reactionPulse;

      const pose = autoPoseRef.current;
      const bodyResponse = speech.speaking ? 9 : 5;
      const handResponse = speech.speaking ? 7 : 4;
      pose.bodyY = smoothToward(pose.bodyY, target.bodyY, bodyResponse, dt);
      pose.bodyLean = smoothToward(pose.bodyLean, target.bodyLean, bodyResponse, dt);
      pose.headY = smoothToward(pose.headY, target.headY, bodyResponse + 1, dt);
      pose.headTilt = smoothToward(pose.headTilt, target.headTilt, bodyResponse + 1, dt);
      pose.leftHandX = smoothToward(pose.leftHandX, target.leftHandX, handResponse, dt);
      pose.leftHandY = smoothToward(pose.leftHandY, target.leftHandY, handResponse, dt);
      pose.rightHandX = smoothToward(pose.rightHandX, target.rightHandX, handResponse, dt);
      pose.rightHandY = smoothToward(pose.rightHandY, target.rightHandY, handResponse, dt);

      setBodyY(base.bodyY + pose.bodyY);
      setBodyLean(base.bodyLean + pose.bodyLean);
      setHeadY(base.headY + pose.headY);
      setHeadTilt(base.headTilt + pose.headTilt);

      if (base.ikStrength > 0.5) {
        setLeftHandX(base.leftHandX + pose.leftHandX);
        setLeftHandY(base.leftHandY + pose.leftHandY);
        setRightHandX(base.rightHandX + pose.rightHandX);
        setRightHandY(base.rightHandY + pose.rightHandY);
      }

      if (target.gesture !== gestureRef.current) {
        gestureRef.current = target.gesture;
        setAgentGesture(target.gesture);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      autoPoseRef.current = { ...zeroAutoPose };
      agentMotionStateRef.current = createAgentMotionState();
      const base = rigRef.current;
      setBodyY(base.bodyY);
      setBodyLean(base.bodyLean);
      setHeadY(base.headY);
      setHeadTilt(base.headTilt);
      if (base.ikStrength > 0.5) {
        setLeftHandX(base.leftHandX);
        setLeftHandY(base.leftHandY);
        setRightHandX(base.rightHandX);
        setRightHandY(base.rightHandY);
      }
    };
    // Speech/energy/text are consumed through refs so this RAF is not restarted on every viseme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentMotionEnabled, motionSweep, viewModelInstance]);

  useEffect(() => {
    if (!motionSweep || !viewModelInstance) return;

    const base = rigRef.current;
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = (now - started) / 1000;
      setBodyY(base.bodyY + Math.sin(t * 1.4) * 3);
      setBodyLean(base.bodyLean + Math.sin(t * 0.8) * 0.035);
      setHeadTilt(base.headTilt + Math.sin(t * 1.1 + 0.5) * 0.08);

      if (base.ikStrength > 0.5) {
        const reachX = Math.sin(t * 1.15) * 34;
        const reachY = Math.cos(t * 0.9) * 24;
        setLeftHandX(base.leftHandX + reachX);
        setLeftHandY(base.leftHandY + reachY);
        setRightHandX(base.rightHandX - reachX);
        setRightHandY(base.rightHandY + reachY);
      } else {
        setLeftShoulder(base.leftShoulder + Math.sin(t * 0.9) * 0.18);
        setRightShoulder(base.rightShoulder - Math.sin(t * 0.9) * 0.18);
        setLeftElbow(base.leftElbow + Math.sin(t * 1.2 + 1) * 0.2);
        setRightElbow(base.rightElbow - Math.sin(t * 1.2 + 1) * 0.2);
      }
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

  useEffect(() => {
    const inferred = inferAgentGesture(speechText, emotion);
    if (inferred !== gestureRef.current && !speaking) {
      gestureRef.current = inferred;
      setAgentGesture(inferred);
    }
  }, [emotion, speaking, speechText]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.44) * 2;
    setGazeX(Math.max(-1, Math.min(1, x)));
    setGazeY(Math.max(-1, Math.min(1, y)));
  };

  const react = () => {
    if (agentMotionEnabled && !motionSweep) {
      reactionStartedAt.current = performance.now();
      return;
    }
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current);
    setBodyY(rig.bodyY - 10);
    setHeadY(rig.headY - 5);
    setHeadTilt(rig.headTilt + 0.09);
    reactionTimer.current = window.setTimeout(() => {
      applyRig(rigRef.current);
      reactionTimer.current = null;
    }, 170);
  };

  const bodyAiLabel = !bindingsReady
    ? 'NOT BOUND'
    : agentMotionEnabled
      ? `BODY AI · ${speaking ? agentGesture.toUpperCase() : 'IDLE'}`
      : 'BODY AI · OFF';

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
          <span><i className={bindingsReady ? 'bound' : 'unbound'} /> Motion lab <em>{bodyAiLabel}</em></span>
          <b>{labOpen ? 'hide' : 'show'}</b>
        </button>

        {labOpen && (
          <div className="motion-lab-body">
            <div className="motion-lab-actions">
              <button
                type="button"
                className={agentMotionEnabled ? 'active' : ''}
                onClick={() => setAgentMotionEnabled((value) => !value)}
                disabled={!bindingsReady}
              >
                Body AI {agentMotionEnabled ? 'on' : 'off'}
              </button>
              <button type="button" className={motionSweep ? 'active' : ''} onClick={() => setMotionSweep((value) => !value)} disabled={!bindingsReady}>
                {motionSweep ? 'Stop sweep' : 'Motion sweep'}
              </button>
              <button type="button" onClick={() => patchRig(defaultRig)} disabled={!bindingsReady}>Reset rig</button>
            </div>

            <div className="rig-grid">
              <RigSlider label="Gesture power" value={gestureStrength} min={0} max={1.5} step={0.05} onChange={setGestureStrength} />
              <RigSlider label="IK strength" value={rig.ikStrength} min={0} max={1} step={0.01} onChange={(value) => updateRig('ikStrength', value)} />
              <RigSlider label="Body lean" value={rig.bodyLean} min={-0.18} max={0.18} step={0.01} onChange={(value) => updateRig('bodyLean', value)} />
              <RigSlider label="Head tilt" value={rig.headTilt} min={-0.3} max={0.3} step={0.01} onChange={(value) => updateRig('headTilt', value)} />
              <RigSlider label="Head X" value={rig.headX} min={-35} max={35} step={1} onChange={(value) => updateRig('headX', value)} />
              <RigSlider label="Head Y" value={rig.headY} min={-25} max={25} step={1} onChange={(value) => updateRig('headY', value)} />
              <RigSlider label="L hand X" value={rig.leftHandX} min={-170} max={20} step={1} onChange={(value) => updateRig('leftHandX', value)} />
              <RigSlider label="L hand Y" value={rig.leftHandY} min={20} max={210} step={1} onChange={(value) => updateRig('leftHandY', value)} />
              <RigSlider label="R hand X" value={rig.rightHandX} min={-20} max={170} step={1} onChange={(value) => updateRig('rightHandX', value)} />
              <RigSlider label="R hand Y" value={rig.rightHandY} min={20} max={210} step={1} onChange={(value) => updateRig('rightHandY', value)} />
              <RigSlider label="L shoulder manual" value={rig.leftShoulder} min={1.05} max={2.35} step={0.01} onChange={(value) => updateRig('leftShoulder', value)} />
              <RigSlider label="L elbow manual" value={rig.leftElbow} min={-1.65} max={0.2} step={0.01} onChange={(value) => updateRig('leftElbow', value)} />
              <RigSlider label="R shoulder manual" value={rig.rightShoulder} min={0.8} max={2.1} step={0.01} onChange={(value) => updateRig('rightShoulder', value)} />
              <RigSlider label="R elbow manual" value={rig.rightElbow} min={-0.2} max={1.65} step={0.01} onChange={(value) => updateRig('rightElbow', value)} />
              <RigSlider label="Eye openness" value={rig.eyeScale} min={0.5} max={1.2} step={0.01} onChange={(value) => updateRig('eyeScale', value)} />
              <RigSlider label="Brow height" value={rig.browY} min={-74} max={-42} step={1} onChange={(value) => updateRig('browY', value)} />
            </div>

            <p className="motion-lab-note">
              {bindingsReady
                ? `Body AI reads live speech energy + transcript intent (${agentGesture}) and turns them into smoothed Rive IK beats, head motion and posture. Disable it for manual rig testing.`
                : 'Rive ViewModel is not bound yet. Controls are intentionally reporting this instead of silently doing nothing.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
