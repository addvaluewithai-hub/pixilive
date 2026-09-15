import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
} from '@rive-app/react-webgl2';
import { useEffect } from 'react';
import type { CharacterDefinition } from '../character/runtime';
import type { Emotion, MouthPose, Viseme } from '../character/types';

interface RiveCharacterStageProps {
  character: CharacterDefinition;
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
}

const emotionIndex: Record<Emotion, number> = {
  calm: 0,
  happy: 1,
  curious: 2,
  excited: 3,
};

const visemeIndex: Record<Viseme, number> = {
  REST: 0,
  MBP: 1,
  FV: 2,
  EE: 3,
  AA: 4,
  OH: 5,
  OO: 6,
  L: 7,
  CONS: 8,
};

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
  const { setValue: setVisemeIndex } = useViewModelInstanceNumber('visemeIndex', viewModelInstance);
  const { setValue: setEmotionIndex } = useViewModelInstanceNumber('emotionIndex', viewModelInstance);
  const { trigger: triggerReaction } = useViewModelInstanceTrigger('react', viewModelInstance);

  useEffect(() => {
    setEmotionIndex(emotionIndex[emotion]);
  }, [emotion, setEmotionIndex]);

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
    setVisemeIndex(visemeIndex[mouth.viseme ?? 'REST']);
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
    setVisemeIndex,
    speaking,
  ]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.44) * 2;
    setGazeX(Math.max(-1, Math.min(1, x)));
    setGazeY(Math.max(-1, Math.min(1, y)));
  };

  return (
    <div
      className="character-stage rive-character-stage"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setGazeX(0);
        setGazeY(0);
      }}
      onPointerDown={() => triggerReaction()}
      aria-label={`${character.name} animated Rive character`}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
