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
import {
  buildScriptBeatPrompt,
  parsePerformanceScript,
  type ScriptPerformanceBeat,
} from './live/scriptPerformance';
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

const TAGGED_STORY_SCRIPT = `[happy]
كان يا ما كان، في غابة صغيرة مليانة نور وألوان، كان إمبر الثعلب الصغير بيصحى كل صباح وهو مستعد لمغامرة جديدة.

[wave]
[excited]
لوّح إمبر لصديقه العصفور وقال: صباح المغامرة! يلا نشوف النهارده مخبي لنا إيه.

[pace:walk]
[thinking]
وبينما كان يمشي بين الأشجار، لاحظ آثار أقدام صغيرة على التراب. وقف لحظة وقال بهدوء: ممم... يا ترى مين عدى من هنا؟

[surprised]
وفجأة! سمع صوتًا عاليًا جاي من وراء شجرة كبيرة، فنط قلبه من المفاجأة وبص بسرعة ناحية الصوت.

[pace:idle]
[sad]
هناك وجد عصفورًا صغيرًا قاعد لوحده، جناحه نازل ووشه حزين لأنه مش عارف يرجع لعيلته.

[crying]
قال العصفور بصوت مرتعش: أنا حاولت ألاقي الطريق... بس كل الشجر بقى شبه بعضه، وأنا خايف أفضل لوحدي.

[thinking]
حط إمبر إيده عند دقنه وفكر شوية: لو طلعنا عند الصخرة العالية، يمكن نقدر نشوف العش من فوق.

[pace:run]
[excited]
جري إمبر بين الأشجار وهو بيقول: لقيتها! عندي خطة، وتعالى بسرعة قبل ما الشمس تنزل!

[laughing]
ولما وصلوا للصخرة، ظهر العش قريب جدًا من المكان اللي بدأوا منه، فضحك إمبر وقال: إحنا لفينا لفة كبيرة علشان نوصل لحاجة كانت جنبنا!

[pace:idle]
[happy]
[wave]
رجع العصفور لعيلته، ولوّح إمبر لهم وهو مبتسم وقال: أهم حاجة إننا ما سبناش صاحبنا لوحده.`;

const STORY_DEMO_PROMPT = `ابدأ الآن اختبار أداء حي لقصة طفل بالعربية. في نفس الرد الصوتي الطويل استخدم set_character_expression عدة مرات أثناء الكلام، وليس مرة واحدة في بداية الرد. غيّر التعبير عند تغيّر المعنى، وطابق نبرة صوتك مع الوجه الحالي. احكِ مشهدًا لطيفًا ومطمئنًا ثم اسأل الطفل سؤالًا بسيطًا.`;

interface ScriptSession {
  beats: ScriptPerformanceBeat[];
  index: number;
  expression: CharacterExpressionName;
}

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
  const [scriptText, setScriptText] = useState(TAGGED_STORY_SCRIPT);
  const [scriptMode, setScriptMode] = useState(false);
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
  const liveStatus = useRef<LiveStatus>('idle');
  const scriptSession = useRef<ScriptSession | null>(null);
  const scriptServerTurnComplete = useRef(false);
  const advanceScriptBeatRef = useRef<() => void>(() => undefined);

  const character = useMemo(() => getCharacterDefinition(characterId), [characterId]);

  const appendCue = (label: string) => {
    setAgentCueTimeline((current) => [...current.slice(-9), label]);
  };

  const finishScript = () => {
    scriptSession.current = null;
    scriptServerTurnComplete.current = false;
    setScriptMode(false);
    setAgentPace('idle');
  };

  const advanceScriptBeat = () => {
    const session = scriptSession.current;
    if (!session) return;

    if (session.index >= session.beats.length) {
      finishScript();
      return;
    }

    const beat = session.beats[session.index];
    session.index += 1;

    for (const cue of beat.cues) {
      if (cue.kind === 'expression') {
        session.expression = cue.value;
        setAgentExpression(cue.value);
        setAgentExpressionIntensity(cue.intensity);
        setAgentExpressionEnergy(cue.energy);
        appendCue(cue.value);
      } else if (cue.kind === 'action') {
        setAgentAction(cue.value);
        setAgentActionNonce((nonce) => nonce + 1);
        appendCue(`↗${cue.value}`);
      } else {
        setAgentPace(cue.value);
        appendCue(`pace:${cue.value}`);
      }
    }

    scriptServerTurnComplete.current = false;
    live.current?.sendText(buildScriptBeatPrompt(beat.text, session.expression));
  };

  advanceScriptBeatRef.current = advanceScriptBeat;

  if (!playback.current) {
    playback.current = new PcmPlaybackQueue(
      (pose) => setMouth(pose),
      () => {
        setMouth(restingMouth);
        if (scriptSession.current && scriptServerTurnComplete.current) {
          scriptServerTurnComplete.current = false;
          advanceScriptBeatRef.current();
        }
      },
    );
  }

  if (!live.current) {
    live.current = new GeminiLiveClient({
      onStatus: (nextStatus) => {
        const previous = liveStatus.current;
        liveStatus.current = nextStatus;
        setStatus(nextStatus);

        if (nextStatus === 'listening' && previous === 'speaking' && scriptSession.current) {
          scriptServerTurnComplete.current = true;
          if (!playback.current?.hasPendingAudio()) {
            scriptServerTurnComplete.current = false;
            advanceScriptBeatRef.current();
          }
        }
      },
      onAudio: (audio) => void playback.current?.enqueue(audio),
      onInputTranscript: setInputTranscript,
      onOutputTranscript: (transcript) => {
        setOutputTranscript(transcript);
        playback.current?.pushTranscript(transcript);
      },
      onCharacterExpression: (cue) => {
        if (scriptSession.current) return;
        setAgentExpression(cue.expression);
        setAgentExpressionIntensity(cue.intensity);
        setAgentExpressionEnergy(cue.energy);
        appendCue(cue.expression);
      },
      onCharacterAction: (nextAction) => {
        if (scriptSession.current) return;
        setAgentAction(nextAction);
        setAgentActionNonce((nonce) => nonce + 1);
        appendCue(`↗${nextAction}`);
      },
      onCharacterPace: (nextPace) => {
        if (scriptSession.current) return;
        setAgentPace(nextPace);
        appendCue(`pace:${nextPace}`);
      },
      onInterrupted: () => {
        finishScript();
        playback.current?.interrupt();
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
      scriptSession.current = null;
      live.current?.close();
      void microphone.current.stop();
      void playback.current?.close();
    };
  }, []);

  const resetAgentPerformance = () => {
    scriptSession.current = null;
    scriptServerTurnComplete.current = false;
    setScriptMode(false);
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
    scriptSession.current = null;
    scriptServerTurnComplete.current = false;
    setScriptMode(false);
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
      await microphone.current.start((chunk) => {
        if (!scriptSession.current) live.current?.sendAudio(chunk);
      });
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not start Gemini Live');
      live.current?.close();
      await microphone.current.stop();
    }
  };

  const disconnect = async () => {
    finishScript();
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
    resetAgentPerformance();
    live.current?.sendText(text);
    setInputTranscript(text.trim());
    setText('');
  };

  const startStoryDemo = () => {
    if (!connected) return;
    resetAgentPerformance();
    setInputTranscript('Freeform test: Gemini directs its own expressions while speaking.');
    live.current?.sendText(STORY_DEMO_PROMPT);
  };

  const startTaggedStory = () => {
    if (!connected) return;
    setError('');
    try {
      const parsed = parsePerformanceScript(scriptText);
      resetAgentPerformance();
      scriptSession.current = {
        beats: parsed.beats,
        index: 0,
        expression: 'happy',
      };
      setScriptMode(true);
      setInputTranscript('Tagged story performance: each tag directly drives the next spoken beat.');
      setOutputTranscript('');
      advanceScriptBeatRef.current();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not parse tagged performance script');
    }
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
          <p>{character.description} Tagged scripts run as direct performance beats: apply the cue, speak the line, then move to the next cue.</p>
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

        <label className="section-label" htmlFor="performance-script">Tagged story script</label>
        <textarea
          id="performance-script"
          className="performance-script"
          value={scriptText}
          onChange={(event) => setScriptText(event.target.value)}
          spellCheck={false}
          aria-label="Tagged performance script"
        />
        <button className="primary" type="button" disabled={!connected || scriptMode} onClick={startTaggedStory}>
          {scriptMode ? 'Tagged story is performing…' : 'Run tagged story — direct beats'}
        </button>
        <button type="button" disabled={!connected || scriptMode} onClick={startStoryDemo}>
          Freeform Gemini-director test
        </button>

        <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round(mouth.energy * 100)}%` }} /></div>
        <p className="hint">
          Mode: {scriptMode ? 'TAGGED SCRIPT · DIRECT BEATS' : 'LIVE AGENT'} · expression {agentExpression ?? mood} · energy {agentExpression ? agentExpressionEnergy.toFixed(2) : 'manual'} · pace {agentPace}
        </p>
        <p className="hint" aria-live="polite">
          Cue timeline: {agentCueTimeline.length ? agentCueTimeline.join(' → ') : 'waiting for performance cues'}
        </p>
        <p className="hint">Script syntax: [happy] [sad] [crying] [surprised] [thinking] [angry] [sleepy] [laughing] [excited], plus [wave] [blink] [jump] and [pace:idle|walk|run]. Each tag is applied directly before Gemini speaks the following story beat, so visual acting and voice direction stay together without transcript timing.</p>
        {error && <p className="error">{error}</p>}
      </aside>
    </main>
  );
}
