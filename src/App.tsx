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
import type {
  CharacterActionName,
  CharacterExpressionName,
  CharacterPace,
  LiveStatus,
} from './live/types';

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

const STORY_DEMO_PROMPT = `ابدأ الآن اختبار أداء حي لقصة طفل بالعربية، باستخدام قصة خيالية لطيفة ومطمئنة. هذا اختبار Gemini 3.8 Live للـnon-blocking stage directions، لذلك في أول رد صوتي واحد لا تثبت على تعبير واحد: غيّر التعبير عدة مرات أثناء استمرار نفس الكلام.

في أول مقطع قبل أن تسأل الطفل أي سؤال، اصنع مشهدًا قصيرًا مدته تقريبًا 25-40 ثانية ويحتوي بشكل طبيعي على 5 إلى 7 تغييرات عاطفية واضحة داخل نفس الـturn. مثال للبنية وليس نصًا يجب تكراره: ابدأ سعيدًا، ثم مفاجأة، ثم تفكير، ثم لحظة حزن أو بكاء خفيف، ثم حماس/ضحك عند انفراج الموقف. استدعِ set_character_expression قبل كل beat مباشرة وأكمل الكلام من غير انتظار أو إعلان اسم التعبير. غيّر صوتك فورًا ليتطابق مع الوجه الحالي.

استخدم wave أو jump مرة أو مرتين فقط لو يخدمان اللحظة، ويمكنك استخدام walk/run ثم الرجوع إلى idle لو الشخصيات داخل القصة تتحرك. لا تستخدم الأدوات لمجرد الاستعراض ولا تجعل الحركة مشتتة. البكاء يكون مؤثرًا لكن آمنًا ومريحًا للطفل، والغضب حازم بدون تخويف أو صراخ.

بعد انتهاء هذا المقطع متعدد المشاعر، اسأل الطفل سؤالًا بسيطًا وانتظر إجابته. في الردود التالية استمر بنفس الأسلوب: عدة beats داخل الرد الواحد كلما تغيّر معنى المشهد، مع السماح للطفل بالمقاطعة والتفاعل.`;

export function App() {
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [emotion, setEmotion] = useState<Emotion>('happy');
  const [mood, setMood] = useState<MoodId>('happy');
  const [action, setAction] = useState<ActionCommand | null>(null);
  const [mouth, setMouth] = useState<MouthPose>(restingMouth);
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [agentExpression, setAgentExpression] = useState<CharacterExpressionName | null>(null);
  const [agentExpressionIntensity, setAgentExpressionIntensity] = useState(1);
  const [agentExpressionEnergy, setAgentExpressionEnergy] = useState(0.5);
  const [agentAction, setAgentAction] = useState<CharacterActionName | null>(null);
  const [agentActionNonce, setAgentActionNonce] = useState(0);
  const [agentPace, setAgentPace] = useState<CharacterPace>('idle');
  const [agentCueTimeline, setAgentCueTimeline] = useState<string[]>([]);
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
      onCharacterExpression: (cue) => {
        setAgentExpression(cue.expression);
        setAgentExpressionIntensity(cue.intensity);
        setAgentExpressionEnergy(cue.energy);
        setAgentCueTimeline((current) => [...current.slice(-7), cue.expression]);
      },
      onCharacterAction: (nextAction) => {
        setAgentAction(nextAction);
        setAgentActionNonce((nonce) => nonce + 1);
        setAgentCueTimeline((current) => [...current.slice(-7), `↗${nextAction}`]);
      },
      onCharacterPace: (nextPace) => {
        setAgentPace(nextPace);
        setAgentCueTimeline((current) => [...current.slice(-7), `pace:${nextPace}`]);
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

  const resetAgentPerformance = () => {
    setAgentExpression(null);
    setAgentExpressionIntensity(1);
    setAgentExpressionEnergy(0.5);
    setAgentAction(null);
    setAgentActionNonce(0);
    setAgentPace('idle');
    setAgentCueTimeline([]);
  };

  const selectCharacter = (event: ChangeEvent<HTMLSelectElement>) => {
    if (sessionLocked) return;
    const next = getCharacterDefinition(event.target.value);
    setCharacterId(next.id);
    setMood(next.defaultEmotion === 'happy' ? 'happy' : 'calm');
    setEmotion(next.defaultEmotion);
    setAction(null);
    setMouth(restingMouth);
    resetAgentPerformance();
    setInputTranscript('');
    setOutputTranscript('');
    setError('');
  };

  const selectMood = (nextMood: MoodId) => {
    setAgentExpression(null);
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
    setAgentPace('idle');
    setStatus('idle');
  };

  const submitText = (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !text.trim()) return;
    setAgentCueTimeline([]);
    live.current?.sendText(text);
    setInputTranscript(text.trim());
    setText('');
  };

  const startStoryDemo = () => {
    if (!connected) return;
    resetAgentPerformance();
    setInputTranscript('اختبار: غيّر عدة تعبيرات أثناء نفس الرد الصوتي واحكِ لي بداية قصة تفاعلية.');
    live.current?.sendText(STORY_DEMO_PROMPT);
  };

  return (
    <main className={`shell shell-${character.theme}`}>
      <header className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <strong>PixiLive</strong>
          <span>Gemini 3.8 Live character lab</span>
        </div>
      </header>

      <section className="hero">
        <div className="copy">
          <span className="eyebrow"><i /> live expressive character runtime</span>
          <h1>Meet {character.name}.<span>{character.tagline}</span></h1>
          <p>{character.description} Gemini 3.8 can cue non-blocking expressions and actions while the same spoken turn keeps streaming.</p>
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
            agentExpression={agentExpression}
            agentExpressionIntensity={agentExpressionIntensity}
            agentExpressionEnergy={agentExpressionEnergy}
            agentAction={agentAction}
            agentActionNonce={agentActionNonce}
            agentPace={agentPace}
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
          Ember runs the client's supplied SVG/controller unchanged. PixiLive only wraps it with live-agent controls.
          {sessionLocked && <span> End the voice session to switch characters.</span>}
        </p>

        <label className="section-label">Mood packs</label>
        <div className="behavior-grid mood-pack-grid">
          {moodPacks.map((pack) => (
            <button key={pack.id} className={mood === pack.id && !agentExpression ? 'active' : ''} onClick={() => selectMood(pack.id)} title={pack.id}>
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

        <label className="section-label">Gemini 3.8 Live</label>
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

        <button className="primary" type="button" disabled={!connected} onClick={startStoryDemo}>
          Start multi-expression story test
        </button>

        <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round(mouth.energy * 100)}%` }} /></div>
        <p className="hint">
          Live performance: {agentExpression ?? mood} · energy {agentExpression ? agentExpressionEnergy.toFixed(2) : 'manual'} · pace {agentPace}
        </p>
        <p className="hint" aria-live="polite">
          Cue timeline: {agentCueTimeline.length ? agentCueTimeline.join(' → ') : 'waiting for live stage directions'}
        </p>
        <p className="hint">Expression/action tools are non-blocking and acknowledged silently, so Ember can change face and movement repeatedly inside one uninterrupted spoken turn while the mouth bridge follows the outgoing audio.</p>
        {error && <p className="error">{error}</p>}
      </aside>
    </main>
  );
}
