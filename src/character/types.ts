export type Emotion = 'calm' | 'happy' | 'curious' | 'excited';

export interface MouthPose {
  open: number;
  width: number;
  round: number;
  energy: number;
}

export interface CharacterSignals {
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
}
