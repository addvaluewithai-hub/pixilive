import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MicrophonePcmStream } from './audio/MicrophonePcmStream';
import { PcmPlaybackQueue } from './audio/PcmPlaybackQueue';
import {
  actionPacks,
  moodPacks,
  type ActionCommand,
  type ActionId,
  type MoodId,
} from './character/behaviorPacks';
import { characterRegistry, DEFAULT_CHARACTER_ID, getCharacterDefinition } from './character/registry';
import type { Emotion, MouthPose } from './character/types';
import { CharacterStage } from './components/CharacterStage';
import { GeminiLiveClient } from './live/GeminiLiveClient';
import type { LiveStatus } from './live/types';

const restingMouth: MouthPose = { open: 0.045, width: 0.37, round: 0.08, energy: 0, viseme: 'REST' };

const moodEmotion: Record<MoodId, Emotion> = {
  calm: 'calm',
  happy: 'happy',
  sad: 'calm',
  thinking: 'curious',
  curious: 'curious',
  excited: 'excited',
  worried: 'curious',
  listening: 'calm',
  confident: 'happy',
  angry: 'excited',
  sleepy: 'calm',
};

export function App() {
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [emotion, setEmotion] = useState<Emotion>('calm');
  const [mood, setMood] = useState<MoodId>('calm');
  const [action, setAction] = useState<ActionCommand | null>(null);
  const [mouth, setMouth] = useState<MouthPose>(restingMouth);
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const microphone = useRef(new MicrophonePcmStream());
  const playback = useRef<PcmPlaybackQueue | null>(null);
  const live = useRef<GeminiLiveClient | null>(null);

  const character = useMemo(() => getCharacterDefinition(characterId), [characterId]);

  if (!playback.current) {
    playback.current = new PcmPlaybackQueue(
      (pose) => setMouth(pose),
      () => setMouth(restingMouth),
    );
  }

  if (!live.current) {
    live.current = new GeminiLiveClient({
      onStatus: setStatus,
      onAudio: (audio) => void playback.current?.enqueue(audio),
      onInputTranscript: setInputTranscript,
      onOutputTranscript: (transcript) => {
        setOutputTranscript(transcript);
        playback.current?.pushTranscript(transcript);
      },
      onInterrupted: () => playback.current?.interrupt(),
      onError: setError,
    });
  }

  const connected = status === 'listening' || status === 'speaking';
  const sessionLocked = status === 'connecting' || connected;
  const speaking = status === 'speaking' || mouth.energy > 0.015;
  const statusLabel = useMemo(
    () => ({ idle: 'offline', connecting: 'connecting', listening: 'listening', speaking: 'speaking', error: 'error' })[status],
    [status],
  );

  useEffect(() => {
    return () => {
      live.current?.close();
      void microphone.current.stop();
      void playback.current?.close();
    };
  }, []);

  const selectCharacter = (event: ChangeEvent<HTMLSelectElement>) => {
    if (sessionLocked) return;
    const next = getCharacterDefinition(event.target.value);
    setCharacterId(next.id);
    setMood('calm');
    setEmotion(next.defaultEmotion);
    setAction(null);
    setMouth(restingMouth);
    setInputTranscript('');
    setOutputTranscript('');
    setError('');
  };

  const selectMood = (nextMood: MoodId) => {
    setMood(nextMood);
    setEmotion(moodEmotion[nextMood]);
  };

  const runAction = (id: ActionId) => {
    setAction((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 }));
  };

  const connect = async () => {
    setError('');
    try {
      await live.current?.connect(character.systemPrompt);
      await microphone.current.start((chunk) => live.current?.sendAudio(chunk));
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not start Gemini Live');
      live.current?.close();
      await microphone.current.stop();
    }
  };

  const disconnect = async () => {
    live.current?.endAudioStream();
    live.current?.close();
    await microphone.current.stop();
    playback.current?.interrupt();
    setStatus('idle');
  };

  const submitText = (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !text.trim()) return;
    live.current?.sendText(text);
    setInputTranscript(text.trim());
    setText('');
  };

  return (
    <main className={`shell shell-${character.theme}`}>
      <header className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <strong>PixiLive</strong>
          <span>Gemini Live character lab</span>
        </div>
      </header>

      <section className="hero">
        <div className="copy">
          <span className="eyebrow"><i /> universal performance runtime</span>
          <h1>Meet {character.name}.<span>{character.tagline}</span></h1>
          <p>{character.description} Universal behavior packs stay reusable across every character rig.</p>
          <div className="transcript" aria-live="polite">
            {inputTranscript && <p><b>You</b>{inputTranscript}</p>}
            {outputTranscript && <p><b>{character.name}</b>{outputTranscript}</p>}
          </div>
        </div>

        <div className="stage-wrap">
          <CharacterStage
            character={character}
            emotion={emotion}
            mouth={mouth}
            speaking={speaking}
            speechText={outputTranscript}
            mood={mood}
            action={action}
          />
        </div>
      </section>

      <aside className="controls">
        <div className="controls-head">
          <strong>Character controls</strong>
          <span className={`status status-${status}`}><i />{statusLabel}</span>
        </div>

        <label className="section-label" htmlFor="character-select">Character</label>
        <select id="character-select" className="character-select" value={character.id} onChange={selectCharacter} disabled={sessionLocked}>
          {characterRegistry.map((item) => (
            <option key={item.id} value={item.id}>{item.name} — {item.tagline}</option>
          ))}
        </select>
        <p className="character-description">
          Same behavior vocabulary, different character adapter.
          {sessionLocked && <span> End the voice session to switch characters.</span>}
        </p>

        <label className="section-label">Mood packs</label>
        <div className="behavior-grid mood-pack-grid">
          {moodPacks.map((pack) => (
            <button key={pack.id} className={mood === pack.id ? 'active' : ''} onClick={() => selectMood(pack.id)} title={pack.id}>
              <span>{pack.emoji}</span>{pack.label}
            </button>
          ))}
        </div>

        <label className="section-label">Reaction packs</label>
        <div className="behavior-grid action-pack-grid">
          {actionPacks.map((pack) => (
            <button key={pack.id} onClick={() => runAction(pack.id)} title={`Play ${pack.label}`}>
              <span>{pack.emoji}</span>{pack.label}
            </button>
          ))}
        </div>

        <label className="section-label">Gemini Live</label>
        {!connected ? (
          <button className="primary" disabled={status === 'connecting'} onClick={() => void connect()}>
            {status === 'connecting' ? 'Connecting…' : `Talk to ${character.name}`}
          </button>
        ) : (
          <button className="danger" onClick={() => void disconnect()}>End voice session</button>
        )}

        <form className="text-turn" onSubmit={submitText}>
          <input
            value={text}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)}
            placeholder={connected ? `Or type to ${character.name}…` : 'Connect to send text'}
            disabled={!connected}
          />
          <button type="submit" disabled={!connected || !text.trim()}>Send</button>
        </form>

        <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round(mouth.energy * 100)}%` }} /></div>
        <p className="hint">Packages express intent (celebrate, think, cry, agree…). Each character translates that intent through its own adapter and can ignore capabilities it does not have.</p>
        {error && <p className="error">{error}</p>}
      </aside>
    </main>
  );
}
