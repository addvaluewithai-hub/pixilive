import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionCommand, MoodId } from '../character/behaviorPacks';
import type { CharacterDefinition } from '../character/runtime';
import type { MouthPose } from '../character/types';
import type { CharacterActionName, CharacterExpressionName, CharacterPace } from '../live/types';

interface EmberHostBridge {
  setExpression: (name: CharacterExpressionName, intensity?: number, energy?: number) => void;
  runAction: (name: CharacterActionName) => void;
  setPace: (pace: CharacterPace) => void;
  setMouth: (pose: MouthPose, speaking: boolean) => void;
  reset: () => void;
}

interface EmberFoxStageProps {
  character: CharacterDefinition;
  mouth: MouthPose;
  speaking: boolean;
  mood: MoodId;
  action: ActionCommand | null;
  agentExpression: CharacterExpressionName | null;
  agentExpressionIntensity: number;
  agentExpressionEnergy: number;
  agentAction: CharacterActionName | null;
  agentActionNonce: number;
  agentPace: CharacterPace;
}

const moodExpression: Record<MoodId, CharacterExpressionName> = {
  calm: 'happy',
  happy: 'happy',
  sad: 'sad',
  thinking: 'thinking',
  curious: 'thinking',
  excited: 'excited',
  worried: 'sad',
  listening: 'thinking',
  confident: 'happy',
  angry: 'angry',
  sleepy: 'sleepy',
};

const moodEnergy: Record<MoodId, number> = {
  calm: 0.35,
  happy: 0.58,
  sad: 0.24,
  thinking: 0.34,
  curious: 0.42,
  excited: 0.88,
  worried: 0.36,
  listening: 0.3,
  confident: 0.58,
  angry: 0.68,
  sleepy: 0.16,
};

const actionExpression: Partial<Record<ActionCommand['id'], CharacterExpressionName>> = {
  celebrate: 'excited',
  laugh: 'laughing',
  cry: 'crying',
  surprised: 'surprised',
  shrug: 'thinking',
  aha: 'excited',
  reassure: 'happy',
  agree: 'happy',
  disagree: 'angry',
  shakeNo: 'angry',
};

const actionNative: Partial<Record<ActionCommand['id'], CharacterActionName>> = {
  celebrate: 'jump',
  aha: 'jump',
  greet: 'wave',
  nod: 'blink',
};

export function EmberFoxStage({
  character,
  mouth,
  speaking,
  mood,
  action,
  agentExpression,
  agentExpressionIntensity,
  agentExpressionEnergy,
  agentAction,
  agentActionNonce,
  agentPace,
}: EmberFoxStageProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const activeExpression = agentExpression ?? moodExpression[mood];
  const activeIntensity = agentExpression ? agentExpressionIntensity : 1;
  const activeEnergy = agentExpression ? agentExpressionEnergy : moodEnergy[mood];
  const source = character.html?.src;

  const bridge = useMemo(() => {
    if (!ready) return null;
    const win = iframeRef.current?.contentWindow as (Window & { EmberHost?: EmberHostBridge }) | null;
    return win?.EmberHost ?? null;
  }, [ready]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'ember-host-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    bridge?.setExpression(activeExpression, activeIntensity, activeEnergy);
  }, [activeEnergy, activeExpression, activeIntensity, bridge]);

  useEffect(() => {
    bridge?.setMouth(mouth, speaking);
  }, [bridge, mouth, speaking]);

  useEffect(() => {
    if (!bridge || !action) return;
    const native = actionNative[action.id];
    const expression = actionExpression[action.id];
    if (expression) bridge.setExpression(expression, 1, expression === 'crying' ? 0.32 : 0.72);
    if (native) bridge.runAction(native);
    if (!expression) return;
    const timeout = window.setTimeout(() => {
      bridge.setExpression(activeExpression, activeIntensity, activeEnergy);
    }, action.id === 'cry' ? 1750 : 1100);
    return () => window.clearTimeout(timeout);
  }, [action?.nonce, bridge]);

  useEffect(() => {
    if (bridge && agentAction) bridge.runAction(agentAction);
  }, [agentAction, agentActionNonce, bridge]);

  useEffect(() => {
    bridge?.setPace(agentPace);
  }, [agentPace, bridge]);

  if (!source) return null;

  return (
    <div className="character-stage ember-character-stage" aria-label={`${character.name} animated character`}>
      <iframe
        ref={iframeRef}
        src={source}
        title={`${character.name} animation`}
        onLoad={() => setReady(Boolean((iframeRef.current?.contentWindow as (Window & { EmberHost?: EmberHostBridge }) | null)?.EmberHost))}
        style={{ width: '100%', height: '100%', border: 0, display: 'block', background: 'transparent' }}
      />
    </div>
  );
}
