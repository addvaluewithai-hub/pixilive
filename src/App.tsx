import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MicrophonePcmStream } from './audio/MicrophonePcmStream';
import { PcmPlaybackQueue } from './audio/PcmPlaybackQueue';
import { characterRegistry, DEFAULT_CHARACTER_ID, getCharacterDefinition } from './character/registry';
import type { CharacterMode, PerformanceCue } from './character/performance';
import type { Emotion, MouthPose } from './character/types';
import { CharacterStage } from './components/CharacterStage';
import { GeminiLiveClient } from './live/GeminiLiveClient';
import type { LiveStatus } from './live/types';

const restingMouth: MouthPose = { open: 0.045, width: 0.37, round: 0.08, energy: 0, viseme: 'REST' };

export function App() {
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [emotion, setEmotion] = useState<Emotion>('calm');
  const [mouth, setMouth] = useState<MouthPose>(restingMouth);
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [characterMode, setCharacterMode] = useState<CharacterMode>('idle');
  const [performanceCue, setPerformanceCue] = useState<PerformanceCue | null>(null);
  const [interruptKey, setInterruptKey] = useState(0);
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');

  const microphone = useRef(new MicrophonePcmStream());
  const playback = useRef<PcmPlaybackQueue | null>(null);
  const live = useRef<GeminiLiveClient | null>(null);
  const statusRef = useRef<LiveStatus>('idle');
  const modeRef = useRef<CharacterMode>('idle');
  const userActiveRef = useRef(false);
  const thinkingTimerRef = useRef<number | null>(null);

  const character = useMemo(() => getCharacterDefinition(characterId), [characterId]);

  const changeCharacterMode = (next: CharacterMode) => {
    modeRef.current = next;
    setCharacterMode(next);
  };

  const clearThinkingTimer = () => {
    if (thinkingTimerRef.current !== null) {
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
  };

  const updateLiveStatus = (next: LiveStatus) => {
    statusRef.current = next;
    setStatus(next);
    if (next === 'speaking') changeCharacterMode('speaking');
    else if (next === 'idle' || next === 'error') changeCharacterMode('idle');
    else if (next === 'connecting') changeCharacterMode('thinking');
    else if (next === 'listening' && userActiveRef.current) changeCharacterMode('listening');
    else if (next === 'listening' && modeRef.current !== 'thinking') changeCharacterMode('listening');
  };

  const handleMicLevel = (level: number) => {
    const speakingThreshold = 0.075;
    const silenceThreshold = 0.035;

    if (level >= speakingThreshold) {
      clearThinkingTimer();
      userActiveRef.current = true;
      changeCharacterMode('listening');
      return;
    }

    if (userActiveRef.current && level <= silenceThreshold) {
      userActiveRef.current = false;
      changeCharacterMode('thinking');
      clearThinkingTimer();
      thinkingTimerRef.current = window.setTimeout(() => {
        thinkingTimerRef.current = null;
        if (statusRef.current === 'listening' && !userActiveRef.current && modeRef.current === 'thinking') {
          changeCharacterMode('listening');
        }
      }, 680);
    }
  };

  if (!playback.current) {
    playback.current = new PcmPlaybackQueue(
      (pose) => setMouth(pose),
      () => setMouth(restingMouth),
    );
  }

  if (!live.current) {
    live.current = new GeminiLiveClient({
      onStatus: updateLiveStatus,
      onAudio: (audio) => void playback.current?.enqueue(audio),
      onInputTranscript: setInputTranscript,
      onOutputTranscript: (transcript) => {
        setOutputTranscript(transcript);
        playback.current?.pushTranscript(transcript);
      },
      onPerformanceCue: (cue) => {
        setPerformanceCue({ ...cue });
        if (statusRef.current !== 'speaking') changeCharacterMode('thinking');
      },
      onPerformanceCancelled: () => {
        setInterruptKey((value) => value + 1);
        if (statusRef.current !== 'idle') changeCharacterMode('listening');
      },
      onInterrupted: () => {
        playback.current?.interrupt();
        changeCharacterMode('listening');
      },
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
      clearThinkingTimer();
      live.current?.close();
      void microphone.current.stop();
      void playback.current?.close();
    };
  }, []);

  const selectCharacter = (event: ChangeEvent<HTMLSelectElement>) => {
    if (sessionLocked) return;
    const next = getCharacterDefinition(event.target.value);
    setCharacterId(next.id);
    setEmotion(next.defaultEmotion);
    setMouth(restingMouth);
    setPerformanceCue(null);
    changeCharacterMode('idle');
    setInputTranscript('');
    setOutputTranscript('');
    setError('');
  };

  const connect = async () => {
    setError('');
    setPerformanceCue(null);
    try {
      await live.current?.connect(character.systemPrompt);
      await microphone.current.start(
        (chunk) => live.current?.sendAudio(chunk),
        handleMicLevel,
      );
      changeCharacterMode('listening');
    } catch (reason) {
      updateLiveStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not start Gemini Live');
      live.current?.close();
      await microphone.current.stop();
    }
  };

  const disconnect = async () => {
    clearThinkingTimer();
    userActiveRef.current = false;
    live.current?.endAudioStream();
    live.current?.close();
    await microphone.current.stop();
    playback.current?.interrupt();
    setInterruptKey((value) => value + 1);
    setPerformanceCue(null);
    changeCharacterMode('idle');
    updateLiveStatus('idle');
  };

  const submitText = (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !text.trim()) return;
    live.current?.sendText(text);
    setInputTranscript(text.trim());
    changeCharacterMode('thinking');
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
          <span className="eyebrow"><i /> procedural character runtime</span>
          <h1>Meet {character.name}.<span>{character.tagline}</span></h1>
          <p>{character.description} Everything visible is rendered and animated from code.</p>
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
            mode={characterMode}
            performanceCue={performanceCue}
            interruptKey={interruptKey}
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
          {character.description}
          {sessionLocked && <span> End the voice session to switch characters.</span>}
        </p>

        <label className="section-label">Emotion</label>
        <div className="emotion-grid">
          {character.emotions.map((item) => (
            <button key={item} className={emotion === item ? 'active' : ''} onClick={() => setEmotion(item)}>{item}</button>
          ))}
        </div>

        <div className="performance-readout" aria-live="polite">
          <span>Performance</span>
          <strong>{characterMode}</strong>
          <em>{performanceCue ? `${performanceCue.affect} · ${performanceCue.gesture}` : 'local autonomous acting'}</em>
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
        <p className="hint">Gemini chooses semantic intent. PixiLive locally handles acting, timing, gesture variation, listening behavior and interruption.</p>
        {error && <p className="error">{error}</p>}
      </aside>
    </main>
  );
}
