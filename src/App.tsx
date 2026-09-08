import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MicrophonePcmStream } from './audio/MicrophonePcmStream';
import { PcmPlaybackQueue } from './audio/PcmPlaybackQueue';
import { LocalPerformanceEngine, type PerformanceCueSource } from './character/LocalPerformanceEngine';
import { characterRegistry, DEFAULT_CHARACTER_ID, getCharacterDefinition } from './character/registry';
import type { CharacterMode, PerformanceCue } from './character/performance';
import type { Emotion, MouthPose } from './character/types';
import { CharacterStage } from './components/CharacterStage';
import { SessionLogPanel } from './components/SessionLogPanel';
import { emitSessionLog, subscribeSessionLog, type SessionLogEvent } from './debug/sessionLog';
import { GeminiLiveClient } from './live/GeminiLiveClient';
import type { LiveStatus } from './live/types';

const restingMouth: MouthPose = { open: 0.045, width: 0.37, round: 0.08, energy: 0, viseme: 'REST' };
type PerformanceSource = PerformanceCueSource | 'tool-prime' | 'autonomous';

export function App() {
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [emotion, setEmotion] = useState<Emotion>('calm');
  const [mouth, setMouth] = useState<MouthPose>(restingMouth);
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [characterMode, setCharacterMode] = useState<CharacterMode>('idle');
  const [performanceCue, setPerformanceCue] = useState<PerformanceCue | null>(null);
  const [performanceSource, setPerformanceSource] = useState<PerformanceSource>('autonomous');
  const [playbackSpeaking, setPlaybackSpeaking] = useState(false);
  const [interruptKey, setInterruptKey] = useState(0);
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sessionLogs, setSessionLogs] = useState<SessionLogEvent[]>([]);

  const microphone = useRef(new MicrophonePcmStream());
  const playback = useRef<PcmPlaybackQueue | null>(null);
  const live = useRef<GeminiLiveClient | null>(null);
  const localPerformance = useRef<LocalPerformanceEngine | null>(null);
  const statusRef = useRef<LiveStatus>('idle');
  const modeRef = useRef<CharacterMode>('idle');
  const userActiveRef = useRef(false);
  const playbackActiveRef = useRef(false);
  const silenceStartedRef = useRef<number | null>(null);
  const pendingToolCueRef = useRef<PerformanceCue | null>(null);
  const pendingToolTimerRef = useRef<number | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const lastProsodyLogRef = useRef(0);

  const character = useMemo(() => getCharacterDefinition(characterId), [characterId]);

  const applyPerformanceCue = (cue: PerformanceCue, source: PerformanceSource, reason: string) => {
    setPerformanceCue({ ...cue });
    setPerformanceSource(source);
    emitSessionLog('character', 'performance_applied', {
      source,
      reason,
      affect: cue.affect,
      gesture: cue.gesture,
      posture: cue.posture,
      gaze: cue.gaze,
      intensity: Number(cue.intensity.toFixed(2)),
    });
  };

  if (!localPerformance.current) {
    localPerformance.current = new LocalPerformanceEngine({
      onCue: (cue, source, reason) => applyPerformanceCue(cue, source, reason),
    });
  }

  const changeCharacterMode = (next: CharacterMode) => {
    const previous = modeRef.current;
    if (previous === next) return;
    modeRef.current = next;
    setCharacterMode(next);
    localPerformance.current?.setMode(next);
    emitSessionLog('character', 'mode_changed', { from: previous, to: next });
  };

  const clearThinkingTimer = () => {
    if (thinkingTimerRef.current !== null) {
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
  };

  const clearPendingToolTimer = () => {
    if (pendingToolTimerRef.current !== null) {
      window.clearTimeout(pendingToolTimerRef.current);
      pendingToolTimerRef.current = null;
    }
  };

  const updateLiveStatus = (next: LiveStatus) => {
    const previous = statusRef.current;
    statusRef.current = next;
    setStatus(next);
    if (previous !== next) emitSessionLog('session', 'status_changed', { from: previous, to: next });

    if (next === 'idle' || next === 'error') changeCharacterMode('idle');
    else if (next === 'connecting') changeCharacterMode('thinking');
    // A network audio event arrives before WebAudio playback. Do not move the
    // character into speaking mode until PcmPlaybackQueue's playback clock fires.
    else if (next === 'speaking' && !playbackActiveRef.current) changeCharacterMode('thinking');
    else if (next === 'listening' && playbackActiveRef.current) return;
    else if (next === 'listening' && userActiveRef.current) changeCharacterMode('listening');
    else if (next === 'listening' && modeRef.current !== 'thinking') changeCharacterMode('listening');
  };

  const handleMicLevel = (level: number) => {
    // Hybrid VAD: Gemini's automatic VAD still owns speech-start robustness and
    // prefix buffering. Local RMS only finalizes a turn after sustained silence.
    const startThreshold = 0.065;
    const endThreshold = 0.028;
    const endSilenceMs = 560;
    const now = performance.now();

    if (level >= startThreshold) {
      silenceStartedRef.current = null;
      clearThinkingTimer();
      if (!userActiveRef.current) {
        userActiveRef.current = true;
        emitSessionLog('user', 'voice_activity_start', { level: Number(level.toFixed(3)) });
      }
      if (!playbackActiveRef.current) changeCharacterMode('listening');
      return;
    }

    if (!userActiveRef.current) return;
    if (level > endThreshold) {
      silenceStartedRef.current = null;
      return;
    }

    if (silenceStartedRef.current === null) {
      silenceStartedRef.current = now;
      return;
    }

    if (now - silenceStartedRef.current < endSilenceMs) return;
    userActiveRef.current = false;
    silenceStartedRef.current = null;
    emitSessionLog('user', 'voice_activity_end', { level: Number(level.toFixed(3)), silenceMs: endSilenceMs });

    // This is the hybrid-VAD latency win: ask Gemini to finalize immediately
    // while its own server VAD remains enabled as the safety net.
    live.current?.endAudioStream();
    emitSessionLog('session', 'hybrid_vad_audio_stream_end', { silenceMs: endSilenceMs });
    if (!playbackActiveRef.current) changeCharacterMode('thinking');

    clearThinkingTimer();
    thinkingTimerRef.current = window.setTimeout(() => {
      thinkingTimerRef.current = null;
      if (statusRef.current === 'listening' && !userActiveRef.current && !playbackActiveRef.current && modeRef.current === 'thinking') {
        changeCharacterMode('listening');
      }
    }, 900);
  };

  if (!playback.current) {
    playback.current = new PcmPlaybackQueue(
      (pose) => setMouth(pose),
      () => setMouth(restingMouth),
      {
        onSpeechStart: () => {
          playbackActiveRef.current = true;
          setPlaybackSpeaking(true);
          changeCharacterMode('speaking');
          const toolCue = pendingToolCueRef.current;
          pendingToolCueRef.current = null;
          clearPendingToolTimer();
          localPerformance.current?.beginSpeech(toolCue);
          emitSessionLog('audio', 'playback_started', { toolCueApplied: Boolean(toolCue) });
        },
        onSpeechDynamics: (dynamics) => {
          localPerformance.current?.updateSpeech(dynamics);
          const now = performance.now();
          if (now - lastProsodyLogRef.current > 650) {
            lastProsodyLogRef.current = now;
            emitSessionLog('audio', 'prosody_sample', {
              energy: Number(dynamics.energy.toFixed(2)),
              pitchHz: Math.round(dynamics.pitchHz),
              pitchNorm: Number(dynamics.pitchNorm.toFixed(2)),
              brightness: Number(dynamics.brightness.toFixed(2)),
              onset: Number(dynamics.onset.toFixed(2)),
            });
          }
        },
        onSpeechEnd: () => {
          playbackActiveRef.current = false;
          setPlaybackSpeaking(false);
          localPerformance.current?.endSpeech();
          emitSessionLog('audio', 'playback_ended');
          if (statusRef.current === 'listening') changeCharacterMode(userActiveRef.current ? 'listening' : 'listening');
        },
      },
    );
  }

  if (!live.current) {
    live.current = new GeminiLiveClient({
      onStatus: updateLiveStatus,
      onAudio: (audio) => void playback.current?.enqueue(audio),
      onInputTranscript: (transcript) => {
        setInputTranscript(transcript);
        localPerformance.current?.pushInputTranscript(transcript);
      },
      onOutputTranscript: (transcript) => {
        setOutputTranscript(transcript);
        playback.current?.pushTranscript(transcript);
        localPerformance.current?.pushOutputTranscript(transcript);
      },
      onPerformanceCue: (cue) => {
        // 3.1 tool calls are sequential. Store the actual gesture until playback
        // begins; before speech, only prime the face/posture very subtly.
        pendingToolCueRef.current = { ...cue };
        clearPendingToolTimer();
        pendingToolTimerRef.current = window.setTimeout(() => {
          pendingToolTimerRef.current = null;
          pendingToolCueRef.current = null;
        }, 5_000);
        applyPerformanceCue({
          ...cue,
          gesture: 'none',
          intensity: Math.min(0.26, Math.max(0.14, cue.intensity * 0.32)),
        }, 'tool-prime', 'subtle anticipation while synchronous tool returns');
        if (!playbackActiveRef.current) changeCharacterMode('thinking');
      },
      onPerformanceCancelled: () => {
        pendingToolCueRef.current = null;
        clearPendingToolTimer();
        setInterruptKey((value) => value + 1);
        if (statusRef.current !== 'idle' && !playbackActiveRef.current) changeCharacterMode('listening');
      },
      onInterrupted: () => {
        pendingToolCueRef.current = null;
        clearPendingToolTimer();
        playback.current?.interrupt();
        if (statusRef.current !== 'idle') changeCharacterMode('listening');
      },
      onError: (message) => {
        emitSessionLog('error', 'ui_error', { message });
        setError(message);
      },
    });
  }

  const connected = status === 'listening' || status === 'speaking';
  const sessionLocked = status === 'connecting' || connected;
  const speaking = playbackSpeaking || mouth.energy > 0.015;
  const statusLabel = useMemo(
    () => ({ idle: 'offline', connecting: 'connecting', listening: 'listening', speaking: 'speaking', error: 'error' })[status],
    [status],
  );

  useEffect(() => subscribeSessionLog((entry) => {
    setSessionLogs((current) => [...current.slice(-399), entry]);
  }), []);

  useEffect(() => {
    return () => {
      clearThinkingTimer();
      clearPendingToolTimer();
      live.current?.close();
      void microphone.current.stop();
      void playback.current?.close();
    };
  }, []);

  const selectCharacter = (event: ChangeEvent<HTMLSelectElement>) => {
    if (sessionLocked) return;
    const next = getCharacterDefinition(event.target.value);
    emitSessionLog('character', 'character_selected', { id: next.id, name: next.name });
    setCharacterId(next.id);
    setEmotion(next.defaultEmotion);
    setMouth(restingMouth);
    setPerformanceCue(null);
    setPerformanceSource('autonomous');
    localPerformance.current?.endSpeech();
    changeCharacterMode('idle');
    setInputTranscript('');
    setOutputTranscript('');
    setError('');
  };

  const connect = async () => {
    setError('');
    setPerformanceCue(null);
    setPerformanceSource('autonomous');
    emitSessionLog('session', 'session_start', { character: character.name, characterId: character.id });
    try {
      await live.current?.connect(character.systemPrompt);
      await microphone.current.start(
        (chunk) => live.current?.sendAudio(chunk),
        handleMicLevel,
      );
      emitSessionLog('user', 'microphone_started');
      changeCharacterMode('listening');
    } catch (reason) {
      updateLiveStatus('error');
      const message = reason instanceof Error ? reason.message : 'Could not start Gemini Live';
      emitSessionLog('error', 'connect_failed', { message });
      setError(message);
      live.current?.close();
      await microphone.current.stop();
    }
  };

  const disconnect = async () => {
    clearThinkingTimer();
    clearPendingToolTimer();
    userActiveRef.current = false;
    playbackActiveRef.current = false;
    pendingToolCueRef.current = null;
    emitSessionLog('session', 'session_end_requested');
    live.current?.endAudioStream();
    live.current?.close();
    await microphone.current.stop();
    playback.current?.interrupt();
    setPlaybackSpeaking(false);
    setInterruptKey((value) => value + 1);
    setPerformanceCue(null);
    setPerformanceSource('autonomous');
    localPerformance.current?.endSpeech();
    changeCharacterMode('idle');
    updateLiveStatus('idle');
  };

  const submitText = (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !text.trim()) return;
    live.current?.sendText(text);
    setInputTranscript(text.trim());
    localPerformance.current?.pushInputTranscript(text.trim());
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
          <em>{performanceCue ? `${performanceCue.affect} · ${performanceCue.gesture} · ${performanceSource}` : 'local autonomous acting'}</em>
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
        <p className="hint">PixiLive now acts locally from playback prosody, transcript meaning and conversation state. Gemini's character tool is an optional high-level override, not a requirement.</p>
        {error && <p className="error">{error}</p>}

        <SessionLogPanel entries={sessionLogs} onClear={() => setSessionLogs([])} />
      </aside>
    </main>
  );
}
