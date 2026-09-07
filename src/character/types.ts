export type Emotion = 'calm' | 'happy' | 'curious' | 'excited';

export type Viseme = 'REST' | 'MBP' | 'FV' | 'EE' | 'AA' | 'OH' | 'OO' | 'L' | 'CONS';

export interface MouthPose {
  open: number;
  width: number;
  round: number;
  energy: number;
  viseme?: Viseme;
  lipPress?: number;
  lowerLipBite?: number;
  teeth?: number;
  tongue?: number;
  cornerPull?: number;
}

export interface CharacterSignals {
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
}
