import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MicrophonePcmStream } from './audio/MicrophonePcmStream';
import { PcmPlaybackQueue } from './audio/PcmPlaybackQueue';
import type { Emotion, MouthPose } from './character/types';
import { CharacterStage } from './components/CharacterStage';
import { GeminiLiveClient } from './live/GeminiLiveClient';
import type { LiveStatus } from './live/types';

const restingMouth: MouthPose = { open: 0.045, width: 0.37, round: 0.08, energy: 0 };
const emotions: Emotion[] = ['calm', 'happy', 'curious', 'excited'];

export function App() {
  const [emotion, setEmotion] = useState<Emotion>('calm');
  const [mouth, setMouth] = useState<MouthPose>(restingMouth);
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [reactionNonce, setReactionNonce] = useState(0);
  const microphone = useRef(new MicrophonePcmStream());
  const playback = useRef<PcmPlaybackQueue | null>(null);
  const live = useRef<GeminiLiveClient | null>(null);

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
      onOutputTranscript: setOutputTranscript,
      onInterrupted: () => playback.current?.interrupt(),
      onError: setError,
    });
  }

  const connected = status === 'listening' || status === 'speaking';
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

  const connect = async () => {
    setError('');
    try {
      await live.current?.connect();
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
    <main className="shell">
      <header className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <strong>PixiLive</strong>
          <span>Gemini Live character lab</span>
        </div>
      </header>

      <section className="hero">
        <div className="copy">
          <span className="eyebrow"><i /> 100% procedural character</span>
          <h1>Meet Milo.<span>Drawn entirely in code.</span></h1>
          <p>A monochrome PixiJS character with a fully controllable face, live speech motion, gaze, emotion and secondary animation — no character image assets.</p>
          <div className="transcript" aria-live="polite">
            {inputTranscript && <p><b>You</b>{inputTranscript}</p>}
            {outputTranscript && <p><b>Milo</b>{outputTranscript}</p>}
          </div>
        </div>

        <div className="stage-wrap">
          <CharacterStage emotion={emotion} mouth={mouth} speaking={speaking} reactionNonce={reactionNonce} />
          <button className="tap-reaction" onClick={() => setReactionNonce((value) => value + 1)} aria-label="Make Milo react" />
        </div>
      </section>

      <aside className="controls">
        <div className="controls-head">
          <strong>Character controls</strong>
          <span className={`status status-${status}`}><i />{statusLabel}</span>
        </div>

        <label className="section-label">Emotion</label>
        <div className="emotion-grid">
          {emotions.map((item) => (
            <button key={item} className={emotion === item ? 'active' : ''} onClick={() => setEmotion(item)}>{item}</button>
          ))}
        </div>

        <label className="section-label">Gemini Live</label>
        {!connected ? (
          <button className="primary" disabled={status === 'connecting'} onClick={() => void connect()}>
            {status === 'connecting' ? 'Connecting…' : 'Start voice session'}
          </button>
        ) : (
          <button className="danger" onClick={() => void disconnect()}>End voice session</button>
        )}

        <form className="text-turn" onSubmit={submitText}>
          <input value={text} onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)} placeholder={connected ? 'Or type to Milo…' : 'Connect to send text'} disabled={!connected} />
          <button type="submit" disabled={!connected || !text.trim()}>Send</button>
        </form>

        <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round(mouth.energy * 100)}%` }} /></div>
        <p className="hint">Audio goes browser → Gemini Live with a short-lived token. Your long-lived key stays inside the Cloudflare Pages Function.</p>
        {error && <p className="error">{error}</p>}
      </aside>
    </main>
  );
}
