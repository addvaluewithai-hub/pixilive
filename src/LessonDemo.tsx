import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { exportSessionLog, subscribeSessionLog, type SessionLogEvent } from './debug/sessionLog';
import { earthLesson } from './lesson/earthLesson';
import type { LessonState } from './lesson/types';
import type { LiveStatus } from './live/types';
import { NovaLessonController } from './sdk/NovaLessonController';
import './lesson-demo.css';

type EarthBeat = (typeof earthLesson.beats)[number];

const statusLabel: Record<LiveStatus, string> = {
  idle: 'جاهزة',
  connecting: 'بتوصل…',
  listening: 'سامعاك',
  speaking: 'بتشرح',
  error: 'حصلت مشكلة',
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

export function LessonDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<NovaLessonController | null>(null);
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [lessonState, setLessonState] = useState<LessonState | null>(null);
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sessionLogs, setSessionLogs] = useState<SessionLogEvent[]>([]);
  const [copiedLog, setCopiedLog] = useState(false);

  const connected = status === 'listening' || status === 'speaking';

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    let disposed = false;
    const unsubscribeLogs = subscribeSessionLog((entry) => {
      setSessionLogs((current) => [...current, entry]);
    });

    const controller = new NovaLessonController({
      container,
      lesson: earthLesson,
      transparent: true,
      onStatus: setStatus,
      onInputTranscript: (value) => setInputTranscript(value),
      onOutputTranscript: (value) => setOutputTranscript(value),
      onError: setError,
    });
    controllerRef.current = controller;
    setLessonState(controller.state);
    const unsubscribeLesson = controller.subscribeLessonState(setLessonState);

    void controller.init().catch((reason) => {
      if (disposed) return;
      setError(reason instanceof Error ? reason.message : 'تعذر تشغيل Nova');
    });

    return () => {
      disposed = true;
      unsubscribeLogs();
      unsubscribeLesson();
      if (controllerRef.current === controller) controllerRef.current = null;
      void controller.destroy();
    };
  }, []);

  const sections = useMemo(() => {
    const grouped = new Map<string, EarthBeat[]>();
    for (const beat of earthLesson.beats) {
      const current = grouped.get(beat.sectionId) ?? [];
      current.push(beat);
      grouped.set(beat.sectionId, current);
    }
    return [...grouped.entries()];
  }, []);

  const understood = lessonState
    ? Object.values(lessonState.beats).filter((beat) => beat.understanding === 'understood').length
    : 0;
  const percent = Math.round((understood / earthLesson.beats.length) * 100);
  const activeBeat = earthLesson.beats.find((beat) => beat.id === lessonState?.currentBeatId);

  const connect = async () => {
    const controller = controllerRef.current;
    if (!controller || connected || status === 'connecting') return;
    setError('');
    setInputTranscript('');
    setOutputTranscript('');
    try {
      await controller.connect();
      const opener = 'اشرحلي الدرس ده بالمصري حتة حتة لحد ما نخلص كل حاجة، وابدأ من المكان اللي أنا واقف عنده.';
      setInputTranscript(opener);
      controller.sendText(opener);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر بدء الجلسة');
    }
  };

  const disconnect = async () => {
    await controllerRef.current?.disconnect();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!connected || !value) return;
    setInputTranscript(value);
    controllerRef.current?.sendText(value);
    setText('');
  };

  const resetLesson = () => {
    if (connected || status === 'connecting') return;
    controllerRef.current?.resetLesson();
    setInputTranscript('');
    setOutputTranscript('');
    setError('');
  };

  const copyLessonLog = async () => {
    const diagnostic = {
      kind: 'pixilive-nova-lesson-diagnostic',
      version: 1,
      exportedAt: new Date().toISOString(),
      note: 'Contains lesson transcripts, Gemini/session events, tool calls, lesson tool responses, timing and lesson state. API keys, ephemeral tokens and raw audio are excluded.',
      lesson: {
        id: earthLesson.id,
        title: earthLesson.title,
        language: earthLesson.language,
        totalBeats: earthLesson.beats.length,
        activeBeat: activeBeat ? {
          id: activeBeat.id,
          sectionId: activeBeat.sectionId,
          title: activeBeat.title,
          objective: activeBeat.objective,
        } : null,
        understoodBeats: understood,
      },
      liveStatus: status,
      lessonState,
      session: exportSessionLog(sessionLogs),
    };

    try {
      await copyText(JSON.stringify(diagnostic, null, 2));
      setCopiedLog(true);
      window.setTimeout(() => setCopiedLog(false), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر نسخ الـ log');
    }
  };

  return (
    <main className="lesson-shell" dir="rtl">
      <section className="lesson-copy">
        <div className="lesson-kicker">منهج الإنسان · تجربة Nova Live</div>
        <h1>الأرض التي نظنّها <em>ثابتة.</em></h1>
        <p className="lesson-question">كيف نعرف أن الأرض تتحرك، حتى عندما لا نشعر بذلك؟</p>

        <div className="lesson-progress-card">
          <div className="progress-head">
            <div>
              <span>تقدّم الدرس</span>
              <strong>{understood} / {earthLesson.beats.length}</strong>
            </div>
            <b>{percent}%</b>
          </div>
          <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
          {activeBeat && (
            <p className="active-beat">
              <small>إحنا هنا</small>
              <span>{activeBeat.title}</span>
            </p>
          )}
          <div className="section-checks">
            {sections.map(([sectionId, beats]) => {
              const complete = beats.every((beat) => lessonState?.beats[beat.id]?.understanding === 'understood');
              const active = beats.some((beat) => beat.id === lessonState?.currentBeatId);
              return (
                <span key={sectionId} className={`${complete ? 'done' : ''} ${active ? 'active' : ''}`}>
                  <i>{complete ? '✓' : sectionId}</i>
                  القسم {sectionId}
                </span>
              );
            })}
          </div>
        </div>

        <div className="lesson-transcript" aria-live="polite">
          {inputTranscript && <p className="user-line"><b>أنت</b><span>{inputTranscript}</span></p>}
          {outputTranscript && <p className="nova-line"><b>Nova</b><span>{outputTranscript}</span></p>}
          {!inputTranscript && !outputTranscript && <p className="empty-line">Nova هتشرح فكرة واحدة كل مرة، وتفضل فاكرة إحنا وقفنا فين حتى لو دخلنا في سؤال جانبي.</p>}
        </div>
      </section>

      <section className="nova-panel">
        <div className="nova-topbar">
          <div className="nova-name"><i /> Nova</div>
          <span className={`live-status live-${status}`}>{statusLabel[status]}</span>
        </div>

        <div ref={stageRef} className="nova-stage" />

        <div className="nova-controls">
          {!connected ? (
            <button className="start-lesson" type="button" onClick={() => void connect()} disabled={status === 'connecting'}>
              {status === 'connecting' ? 'بنجهّز Nova…' : understood > 0 ? 'كمّل من علامتك' : 'ابدأ الدرس'}
            </button>
          ) : (
            <button className="end-lesson" type="button" onClick={() => void disconnect()}>إنهاء الجلسة</button>
          )}

          <form className="lesson-text-turn" onSubmit={submit}>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={connected ? 'قول أو اكتب اللي مش فاهمه…' : 'ابدأ الجلسة الأول'}
              disabled={!connected}
            />
            <button type="submit" disabled={!connected || !text.trim()}>إرسال</button>
          </form>

          <div className="lesson-diagnostics">
            <button className="copy-lesson-log" type="button" onClick={() => void copyLessonLog()} disabled={!sessionLogs.length}>
              {copiedLog ? '✓ اتنسخ — ابعتهولي' : `نسخ الـ log كامل (${sessionLogs.length})`}
            </button>
            <button className="clear-lesson-log" type="button" onClick={() => setSessionLogs([])} disabled={!sessionLogs.length}>
              مسح الـ log
            </button>
            <p>بيشمل المحادثة، tool calls والـ responses، التوقيت، وآخر lesson state. من غير API keys أو raw audio.</p>
          </div>

          <button className="reset-progress" type="button" onClick={resetLesson} disabled={connected || status === 'connecting'}>
            ابدأ الدرس من الأول
          </button>
          {lessonState?.detours.length ? (
            <p className="detour-note">في سؤال جانبي مفتوح · Nova هترجع تلقائيًا لنقطة الدرس بعد ما يخلص.</p>
          ) : null}
          {error && <p className="lesson-error">{error}</p>}
        </div>
      </section>
    </main>
  );
}
