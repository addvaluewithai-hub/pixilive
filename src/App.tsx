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
type PerformanceSource = PerformanceCueSource | 'tool-prime' | 'autonomous' | 'manual';

const movementDemos: Array<{ label: string; cue: PerformanceCue }> = [
  { label: 'greet', cue: { affect: 'warm', intensity: 0.9, gesture: 'greet', posture: 'open', gaze: 'user' } },
  { label: 'explain', cue: { affect: 'enthusiastic', intensity: 0.9, gesture: 'explain', posture: 'engaged', gaze: 'user' } },
  { label: 'emphasize', cue: { affect: 'neutral', intensity: 0.92, gesture: 'emphasize', posture: 'engaged', gaze: 'user' } },
  { label: 'reassure', cue: { affect: 'reassuring', intensity: 0.86, gesture: 'reassure', posture: 'lean_in', gaze: 'user' } },
  { label: 'think', cue: { affect: 'thoughtful', intensity: 0.86, gesture: 'think', posture: 'lean_back', gaze: 'thinking_up' } },
  { label: 'celebrate', cue: { affect: 'enthusiastic', intensity: 1, gesture: 'celebrate', posture: 'open', gaze: 'user' } },
  { label: 'shrug', cue: { affect: 'playful', intensity: 0.92, gesture: 'shrug', posture: 'open', gaze: 'user' } },
];

const neutralDemoCue: PerformanceCue = {
  affect: 'neutral',
  intensity: 0.2,
  gesture: 'none',
  posture: 'neutral',
  gaze: 'user',
};

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
  const textTurnPendingRef = useRef(false);
  const silenceStartedRef = useRef<number | null>(null);
  const pendingToolCueRef = useRef<PerformanceCue | null>(null);
  const pendingToolTimerRef = useRef<number | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const movementDemoTimerRef = useRef<number | null>(null);
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

  const clearMovementDemoTimer = () => {
    if (movementDemoTimerRef.current !== null) {
      window.clearTimeout(movementDemoTimerRef.current);
      movementDemoTimerRef.current = null;
    }
  };

  const triggerMovementDemo = (cue: PerformanceCue) => {
    clearMovementDemoTimer();
    applyPerformanceCue(cue, 'manual', 'movement lab manual trigger');
    // Offline testing should still use the full-performance gain so a body-rig
    // problem cannot hide behind the intentionally subtle idle mode.
    if (statusRef.current === 'idle') {
      changeCharacterMode('speaking');
      movementDemoTimerRef.current = window.setTimeout(() => {
        movementDemoTimerRef.current = null;
        if (statusRef.current === 'idle') {
          applyPerformanceCue(neutralDemoCue, 'manual', 'movement lab settle');
          changeCharacterMode('idle');
        }
      }, 3_200);
    }
  };

  const resetMovementDemo = () => {
    clearMovementDemoTimer();
    applyPerformanceCue(neutralDemoCue, 'manual', 'movement lab reset');
    if (statusRef.current === 'idle') changeCharacterMode('idle');
  };

  const updateLiveStatus = (next: LiveStatus) => {
    const previous = statusRef.current;
    statusRef.current = next;
    setStatus(next);
    if (previous !== next) emitSessionLog('session', 'status_changed', { from: previous, to: next });

    if (previous === 'speaking' && next === 'listening') playback.current?.markTurnComplete();

    if (next === 'idle' || next === 'error') changeCharacterMode('idle');
    else if (next === 'connecting') changeCharacterMode('thinking');
    else if (next === 'speaking' && !playbackActiveRef.current) changeCharacterMode('thinking');
    else if (next === 'listening' && playbackActiveRef.current) return;
    else if (next === 'listening' && userActiveRef.current) changeCharacterMode('listening');
    else if (next === 'listening' && modeRef.current !== 'thinking') changeCharacterMode('listening');
  };

  const handleMicLevel = (level: number) => {
    const startThreshold = 0.065;
    const endThreshold = 0.028;
    const endSilenceMs = 560;
    const now = performance.now();

    if (playbackActiveRef.current || textTurnPendingRef.current) {
      userActiveRef.current = false;
      silenceStartedRef.current = null;
      return;
    }

    if (level >= startThreshold) {
      silenceStartedRef.current = null;
      clearThinkingTimer();
      if (!userActiveRef.current) {
        userActiveRef.current = true;
        emitSessionLog('user', 'voice_activity_start', { level: Number(level.toFixed(3)) });
      }
      changeCharacterMode('listening');
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
    live.current?.endAudioStream();
    emitSessionLog('session', 'hybrid_vad_audio_stream_end', { silenceMs: endSilenceMs });
    changeCharacterMode('thinking');

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
          textTurnPendingRef.current = false;
          userActiveRef.current = false;
          silenceStartedRef.current = null;
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
              voiced: Number(dynamics.voiced.toFixed(2)),
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
          if (statusRef.current === 'listening') changeCharacterMode('listening');
          else if (statusRef.current === 'speaking') changeCharacterMode('thinking');
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
        // A Gemini 3.1 tool call can arrive after audio playback has already
        // started. In that case execute it immediately; waiting for another
        // onSpeechStart would silently lose the real gesture.
        if (playbackActiveRef.current) {
          pendingToolCueRef.current = null;
          clearPendingToolTimer();
          localPerformance.current?.applyToolCue(cue, 'tool cue arrived during active playback');
          return;
        }

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
        changeCharacterMode('thinking');
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
        textTurnPendingRef.current = false;
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
      clearMovementDemoTimer();
      live.current?.close();
      void microphone.current.stop();
      void playback.current?.close();
    };
  }, []);

  const selectCharacter = (event: ChangeEvent<HTMLSelectElement>) => {
    if (sessionLocked) return;
    const next = getCharacterDefinition(event.target.value);
    emitSessionLog('character', 'character_selected', { id: next.id, name: next.name });
    clearMovementDemoTimer();
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
    clearMovementDemoTimer();
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
    clearMovementDemoTimer();
    userActiveRef.current = false;
    playbackActiveRef.current = false;
    textTurnPendingRef.current = false;
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
    const value = text.trim();
    textTurnPendingRef.current = true;
    userActiveRef.current = false;
    silenceStartedRef.current = null;
    live.current?.sendText(value);
    setInputTranscript(value);
    localPerformance.current?.pushInputTranscript(value);
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
            <button type="button" key={item} className={emotion === item ? 'active' : ''} onClick={() => setEmotion(item)}>{item}</button>
          ))}
        </div>

        <label className="section-label">Movement lab</label>
        <p className="character-description">Direct rig test — works offline and bypasses Gemini so you can judge the body system itself.</p>
        <div className="emotion-grid">
          {movementDemos.map(({ label, cue }) => (
            <button type="button" key={label} onClick={() => triggerMovementDemo(cue)}>{label}</button>
          ))}
          <button type="button" onClick={resetMovementDemo}>reset</button>
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
        <p className="hint">PixiLive acts locally from playback prosody, transcript meaning and conversation state. Gemini's character tool is only an optional high-level override.</p>
        {error && <p className="error">{error}</p>}

        <SessionLogPanel entries={sessionLogs} onClear={() => setSessionLogs([])} />
      </aside>
    </main>
  );
}
