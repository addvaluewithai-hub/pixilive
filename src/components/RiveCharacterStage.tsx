import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
} from '@rive-app/react-webgl2';
import { useEffect, useRef, useState } from 'react';
import {
  actionEnvelope,
  getActionPack,
  getMoodPack,
  type ActionCommand,
  type MoodId,
} from '../character/behaviorPacks';
import {
  createAgentMotionState,
  inferAgentGesture,
  stepAgentMotion,
  type AgentGesture,
} from '../character/agentMotion';
import {
  zeroPerformancePose,
  type StandardPerformancePose,
} from '../character/performanceAdapter';
import type { CharacterDefinition } from '../character/runtime';
import type { Emotion, MouthPose } from '../character/types';

interface RiveCharacterStageProps {
  character: CharacterDefinition;
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
  speechText: string;
  mood: MoodId;
  action: ActionCommand | null;
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

type AutoPose = StandardPerformancePose;

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

const emotionFace: Record<Emotion, Partial<RigState>> = {
  calm: { eyeScale: 0.92, browY: -53, smileOpacity: 0.04, neutralOpacity: 1, headTilt: 0 },
  happy: { eyeScale: 0.8, browY: -58, smileOpacity: 0.7, neutralOpacity: 0.25, headTilt: 0.025 },
  curious: { eyeScale: 1.0, browY: -61, smileOpacity: 0.12, neutralOpacity: 0.9, headTilt: -0.08 },
  excited: { eyeScale: 1.04, browY: -63, smileOpacity: 0.82, neutralOpacity: 0.18, headTilt: 0.045 },
};

const smoothToward = (current: number, target: number, response: number, dt: number) => {
  const alpha = 1 - Math.exp(-Math.min(0.05, dt) * response);
  return current + (target - current) * alpha;
};

const addPose = (...poses: StandardPerformancePose[]): StandardPerformancePose =>
  poses.reduce<StandardPerformancePose>(
    (sum, pose) => ({
      bodyY: sum.bodyY + pose.bodyY,
      bodyLean: sum.bodyLean + pose.bodyLean,
      headY: sum.headY + pose.headY,
      headTilt: sum.headTilt + pose.headTilt,
      leftHandX: sum.leftHandX + pose.leftHandX,
      leftHandY: sum.leftHandY + pose.leftHandY,
      rightHandX: sum.rightHandX + pose.rightHandX,
      rightHandY: sum.rightHandY + pose.rightHandY,
      eyeScale: sum.eyeScale + pose.eyeScale,
      browY: sum.browY + pose.browY,
      smileOpacity: sum.smileOpacity + pose.smileOpacity,
      neutralOpacity: sum.neutralOpacity + pose.neutralOpacity,
    }),
    { ...zeroPerformancePose },
  );

export function RiveCharacterStage({
  character,
  emotion,
  mouth,
  speaking,
  speechText,
  mood,
  action,
}: RiveCharacterStageProps) {
  const source = character.rive;
  const performanceAdapter = character.performanceAdapter;
  if (!source) throw new Error(`${character.name} is missing its Rive source configuration.`);
  if (!performanceAdapter) throw new Error(`${character.name} is missing its performance adapter.`);

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
  const [agentMotionEnabled, setAgentMotionEnabled] = useState(true);
  const [gestureStrength, setGestureStrength] = useState(1);
  const [agentGesture, setAgentGesture] = useState<AgentGesture>('conversational');
  const [activeAction, setActiveAction] = useState<string>('none');

  const rigRef = useRef<RigState>(defaultRig);
  const autoPoseRef = useRef<AutoPose>({ ...zeroPerformancePose });
  const agentMotionStateRef = useRef(createAgentMotionState());
  const gestureRef = useRef<AgentGesture>('conversational');
  const speechRef = useRef({ speaking, energy: mouth.energy, emotion, text: speechText, strength: gestureStrength });
  const moodRef = useRef(mood);
  const actionRef = useRef<ActionCommand | null>(action);
  const actionStartedAt = useRef(-10_000);
  const lastActionNonce = useRef(-1);
  const activeActionRef = useRef('none');
  const reactionStartedAt = useRef(-10_000);

  rigRef.current = rig;
  speechRef.current = { speaking, energy: mouth.energy, emotion, text: speechText, strength: gestureStrength };
  moodRef.current = mood;
  actionRef.current = action;

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

  const { setValue: setBodyY } = useViewModelInstanceNumber('bodyY', viewModelInstance);
  const { setValue: setBodyLean } = useViewModelInstanceNumber('bodyLean', viewModelInstance);
  const { setValue: setHeadY } = useViewModelInstanceNumber('headY', viewModelInstance);
  const { setValue: setHeadTilt } = useViewModelInstanceNumber('headTilt', viewModelInstance);
  const { setValue: setLeftHandX } = useViewModelInstanceNumber('leftHandX', viewModelInstance);
  const { setValue: setLeftHandY } = useViewModelInstanceNumber('leftHandY', viewModelInstance);
  const { setValue: setRightHandX } = useViewModelInstanceNumber('rightHandX', viewModelInstance);
  const { setValue: setRightHandY } = useViewModelInstanceNumber('rightHandY', viewModelInstance);
  const { setValue: setEyeScale } = useViewModelInstanceNumber('eyeScale', viewModelInstance);
  const { setValue: setBrowY } = useViewModelInstanceNumber('browY', viewModelInstance);
  const { setValue: setSmileOpacity } = useViewModelInstanceNumber('smileOpacity', viewModelInstance);
  const { setValue: setNeutralOpacity } = useViewModelInstanceNumber('neutralOpacity', viewModelInstance);

  useEffect(() => {
    const face = emotionFace[emotion];
    setRig((current) => {
      const next = { ...current, ...face };
      rigRef.current = next;
      return next;
    });
  }, [emotion]);

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
  }, [
    mouth,
    setCornerPull,
    setLipPress,
    setLowerLipBite,
    setMouthOpen,
    setMouthRound,
    setMouthWidth,
    setSpeaking,
    setSpeechEnergy,
    setTeeth,
    setTongue,
    speaking,
  ]);

  useEffect(() => {
    if (action && action.nonce !== lastActionNonce.current) {
      lastActionNonce.current = action.nonce;
      actionStartedAt.current = performance.now();
      activeActionRef.current = action.id;
      setActiveAction(action.id);
    }
  }, [action]);

  useEffect(() => {
    if (!viewModelInstance) return;

    agentMotionStateRef.current = createAgentMotionState();
    autoPoseRef.current = { ...zeroPerformancePose };
    let previousTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;
      const speech = speechRef.current;
      const base = rigRef.current;

      let speechPose = { ...zeroPerformancePose };
      if (agentMotionEnabled) {
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
        speechPose = {
          ...zeroPerformancePose,
          bodyY: target.bodyY,
          bodyLean: target.bodyLean,
          headY: target.headY,
          headTilt: target.headTilt,
          leftHandX: target.leftHandX,
          leftHandY: target.leftHandY,
          rightHandX: target.rightHandX,
          rightHandY: target.rightHandY,
          eyeScale: target.eyeScale,
          browY: target.browY,
        };
        if (target.gesture !== gestureRef.current) {
          gestureRef.current = target.gesture;
          setAgentGesture(target.gesture);
        }
      }

      const moodPack = getMoodPack(moodRef.current);
      const moodPose = performanceAdapter.sample(moodPack.intent, { weight: 1, phase: 0 });

      let actionPose = { ...zeroPerformancePose };
      const currentAction = actionRef.current;
      if (currentAction) {
        const pack = getActionPack(currentAction.id);
        const elapsed = now - actionStartedAt.current;
        const duration = pack.durationMs ?? 1000;
        const envelope = actionEnvelope(pack.pattern, elapsed, duration);
        if (envelope.weight > 0) {
          const sampled = performanceAdapter.sample(pack.intent, envelope);
          actionPose = performanceAdapter.applyPattern
            ? performanceAdapter.applyPattern(sampled, pack.pattern, envelope.phase)
            : sampled;
        } else if (activeActionRef.current !== 'none') {
          activeActionRef.current = 'none';
          setActiveAction('none');
        }
      }

      const reactionAge = now - reactionStartedAt.current;
      const reactionProgress = Math.max(0, Math.min(1, reactionAge / 260));
      const reactionPulse = reactionAge >= 0 && reactionProgress < 1 ? Math.sin(Math.PI * reactionProgress) : 0;
      const reactionPose: StandardPerformancePose = {
        ...zeroPerformancePose,
        bodyY: -5 * reactionPulse,
        headY: -3 * reactionPulse,
        headTilt: 0.045 * reactionPulse,
      };

      const targetPose = addPose(moodPose, actionPose, speechPose, reactionPose);
      const pose = autoPoseRef.current;
      const bodyResponse = activeActionRef.current !== 'none' ? 10 : speech.speaking ? 8 : 5;
      const handResponse = activeActionRef.current !== 'none' ? 9 : speech.speaking ? 7 : 5;

      pose.bodyY = smoothToward(pose.bodyY, targetPose.bodyY, bodyResponse, dt);
      pose.bodyLean = smoothToward(pose.bodyLean, targetPose.bodyLean, bodyResponse, dt);
      pose.headY = smoothToward(pose.headY, targetPose.headY, bodyResponse + 1, dt);
      pose.headTilt = smoothToward(pose.headTilt, targetPose.headTilt, bodyResponse + 1, dt);
      pose.leftHandX = smoothToward(pose.leftHandX, targetPose.leftHandX, handResponse, dt);
      pose.leftHandY = smoothToward(pose.leftHandY, targetPose.leftHandY, handResponse, dt);
      pose.rightHandX = smoothToward(pose.rightHandX, targetPose.rightHandX, handResponse, dt);
      pose.rightHandY = smoothToward(pose.rightHandY, targetPose.rightHandY, handResponse, dt);
      pose.eyeScale = smoothToward(pose.eyeScale, targetPose.eyeScale, bodyResponse, dt);
      pose.browY = smoothToward(pose.browY, targetPose.browY, bodyResponse, dt);
      pose.smileOpacity = smoothToward(pose.smileOpacity, targetPose.smileOpacity, bodyResponse, dt);
      pose.neutralOpacity = smoothToward(pose.neutralOpacity, targetPose.neutralOpacity, bodyResponse, dt);

      setBodyY(base.bodyY + pose.bodyY);
      setBodyLean(base.bodyLean + pose.bodyLean);
      setHeadY(base.headY + pose.headY);
      setHeadTilt(base.headTilt + pose.headTilt);
      setLeftHandX(base.leftHandX + pose.leftHandX);
      setLeftHandY(base.leftHandY + pose.leftHandY);
      setRightHandX(base.rightHandX + pose.rightHandX);
      setRightHandY(base.rightHandY + pose.rightHandY);
      setEyeScale(Math.max(0.45, base.eyeScale + pose.eyeScale));
      setBrowY(base.browY + pose.browY);
      setSmileOpacity(speech.speaking ? 0 : Math.max(0, Math.min(1, base.smileOpacity + pose.smileOpacity)));
      setNeutralOpacity(speech.speaking ? 0 : Math.max(0, Math.min(1, base.neutralOpacity - pose.smileOpacity + pose.neutralOpacity)));

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Live values are consumed through refs to avoid restarting the RAF on every viseme/transcript update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModelInstance, agentMotionEnabled, performanceAdapter]);

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

  const bodyAiLabel = !bindingsReady
    ? 'NOT BOUND'
    : agentMotionEnabled
      ? `BODY AI · ${speaking ? agentGesture.toUpperCase() : mood.toUpperCase()}`
      : 'BODY AI · OFF';

  return (
    <div
      className="character-stage rive-character-stage"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setGazeX(0);
        setGazeY(0);
      }}
      onPointerDown={() => { reactionStartedAt.current = performance.now(); }}
      aria-label={`${character.name} animated Rive character`}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />

      <section
        className={`rive-motion-lab ${labOpen ? 'open' : ''}`}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Rive behavior playground"
      >
        <button className="motion-lab-toggle" type="button" onClick={() => setLabOpen((value) => !value)}>
          <span><i className={bindingsReady ? 'bound' : 'unbound'} /> Performance engine <em>{bodyAiLabel}</em></span>
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
                Speech motion {agentMotionEnabled ? 'on' : 'off'}
              </button>
              <button type="button" disabled>
                Action: {activeAction}
              </button>
            </div>

            <label className="rig-slider">
              <span>Speech gesture power <b>{gestureStrength.toFixed(2)}</b></span>
              <input type="range" min={0} max={1.5} step={0.05} value={gestureStrength} onChange={(event) => setGestureStrength(Number(event.target.value))} />
            </label>

            <p className="motion-lab-note">
              {bindingsReady
                ? `Universal packs describe intent, not coordinates. Adapter: ${performanceAdapter.id}. Current mood: ${mood}; speech gesture: ${agentGesture}; one-shot action: ${activeAction}.`
                : 'Rive ViewModel is not bound yet.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
