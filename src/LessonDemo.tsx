import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeSessionLog, type SessionLogEvent } from './debug/sessionLog';
import { earthLesson } from './lesson/earthLesson';
import type { LessonState } from './lesson/types';
import type { LiveStatus } from './live/types';
import { NovaLessonController } from './sdk/NovaLessonController';
import './lesson-demo.css';

type EarthBeat = (typeof earthLesson.beats)[number];
type DrawerMode = 'closed' | 'conversation' | 'diagnostics';

type ReviewItem =
  | { kind: 'student'; text: string }
  | { kind: 'nova'; text: string }
  | { kind: 'tool'; name: string; args: Record<string, unknown>; response?: unknown };

type ConversationItem = Extract<ReviewItem, { kind: 'student' | 'nova' }>;
type ToolItem = Extract<ReviewItem, { kind: 'tool' }>;

const statusLabel: Record<LiveStatus, string> = {
  idle: 'جاهزة',
  connecting: 'بتوصل…',
  listening: 'سامعاك',
  speaking: 'بتشرح',
  error: 'حصلت مشكلة',
};

const sectionTitles: Record<string, string> = {
  '01': 'اللغز',
  '02': 'تحت أقدامنا',
  '03': 'الدليل',
  '04': 'جرّب الفكرة',
  '05': 'الزمن والمحرك',
  '06': 'فسّر بنفسك',
};

const understandingLabel = {
  unknown: 'لسه بنبدأ',
  struggling: 'محتاج تبسيط',
  partial: 'قربنا',
  understood: 'اتثبتت',
} as const;

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

function isReviewEvent(entry: SessionLogEvent) {
  if (entry.category === 'user') return entry.event === 'text_sent' || entry.event === 'transcript';
  if (entry.category === 'gemini') return entry.event === 'first_output_transcript' || entry.event === 'output_transcript';
  if (entry.category !== 'tool') return false;
  if (entry.event === 'lesson_tool_response') return true;
  if (entry.event !== 'call_received') return false;
  return entry.data?.name !== 'direct_character';
}

function mergeTranscript(current: string, incoming: string) {
  const left = current.replace(/\s+/g, ' ').trim();
  const right = incoming.replace(/\s+/g, ' ').trim();
  if (!left) return right;
  if (!right || left === right || left.endsWith(right)) return left;
  if (right.startsWith(left)) return right;

  const maxOverlap = Math.min(80, left.length, right.length);
  for (let overlap = maxOverlap; overlap >= 3; overlap -= 1) {
    if (left.slice(-overlap) === right.slice(0, overlap)) return `${left}${right.slice(overlap)}`;
  }

  const needsSpace = !/[\s،,.!?؟:؛]$/.test(left) && !/^[\s،,.!?؟:؛]/.test(right);
  return `${left}${needsSpace ? ' ' : ''}${right}`;
}

function buildReviewItems(entries: SessionLogEvent[]) {
  const items: ReviewItem[] = [];

  const appendSpeech = (kind: 'student' | 'nova', text: unknown) => {
    if (typeof text !== 'string' || !text.trim()) return;
    const previous = items.at(-1);
    if (previous?.kind === kind) {
      previous.text = mergeTranscript(previous.text, text);
      return;
    }
    items.push({ kind, text: text.trim() });
  };

  for (const entry of entries) {
    if (entry.category === 'user' && (entry.event === 'text_sent' || entry.event === 'transcript')) {
      appendSpeech('student', entry.data?.text);
      continue;
    }

    if (entry.category === 'gemini' && (entry.event === 'first_output_transcript' || entry.event === 'output_transcript')) {
      appendSpeech('nova', entry.data?.text);
      continue;
    }

    if (entry.category === 'tool' && entry.event === 'call_received') {
      const name = typeof entry.data?.name === 'string' ? entry.data.name : '';
      if (!name || name === 'direct_character') continue;
      const args = entry.data?.args && typeof entry.data.args === 'object'
        ? entry.data.args as Record<string, unknown>
        : {};
      items.push({ kind: 'tool', name, args });
      continue;
    }

    if (entry.category === 'tool' && entry.event === 'lesson_tool_response') {
      const name = typeof entry.data?.name === 'string' ? entry.data.name : '';
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const candidate = items[index];
        if (candidate.kind === 'tool' && candidate.name === name && candidate.response === undefined) {
          candidate.response = entry.data?.response;
          break;
        }
      }
    }
  }

  return items;
}

function formatReviewLog(entries: SessionLogEvent[], activeBeat: EarthBeat | undefined, understood: number) {
  const items = buildReviewItems(entries);
  const lines = [
    '# Nova lesson review log',
    `Progress: ${understood}/${earthLesson.beats.length} understood`,
    `Active beat: ${activeBeat ? `${activeBeat.id} — ${activeBeat.title}` : 'unknown'}`,
    '',
  ];

  items.forEach((item, index) => {
    const number = index + 1;
    if (item.kind === 'student') {
      lines.push(`[${number}] STUDENT`, item.text, '');
      return;
    }
    if (item.kind === 'nova') {
      lines.push(`[${number}] NOVA`, item.text, '');
      return;
    }
    lines.push(
      `[${number}] TOOL ${item.name}`,
      `args: ${JSON.stringify(item.args)}`,
      `result: ${item.response === undefined ? '(no response captured)' : JSON.stringify(item.response)}`,
      '',
    );
  });

  return lines.join('\n').trim();
}

function BoardVisual({ sectionId }: { sectionId?: string }) {
  switch (sectionId) {
    case '02':
      return (
        <div className="board-visual visual-layers" aria-label="الصفيحة والوشاح">
          <div className="earth-layer crust"><span>القشرة</span></div>
          <div className="earth-layer lithosphere"><strong>الصفيحة</strong><span>القشرة + الجزء العلوي الصلب من الوشاح</span></div>
          <div className="earth-layer mantle"><strong>الوشاح</strong><span>صلب في معظمه · يتشوه ببطء شديد</span></div>
        </div>
      );
    case '03':
      return (
        <div className="board-visual visual-ridge" aria-label="حيد وسط المحيط">
          <span className="age old">أقدم</span>
          <div className="seafloor left"><i /></div>
          <div className="ridge-core"><b>حيد</b><small>قشرة جديدة</small></div>
          <div className="seafloor right"><i /></div>
          <span className="age old">أقدم</span>
          <div className="ridge-arrows"><span>←</span><span>→</span></div>
        </div>
      );
    case '04':
      return (
        <div className="board-visual visual-boundaries" aria-label="أنواع حدود الصفائح">
          <div><b>← →</b><span>تباعد</span></div>
          <div><b>→ ←</b><span>تقارب</span></div>
          <div><b>⇄</b><span>تحويلي</span></div>
        </div>
      );
    case '05':
      return (
        <div className="board-visual visual-time" aria-label="تراكم الحركة عبر الزمن">
          <div><strong>3 سم</strong><span>كل سنة</span></div>
          <b>×</b>
          <div><strong>1,000,000</strong><span>سنة</span></div>
          <b>=</b>
          <div className="time-answer"><strong>30 كم</strong><span>في المثال</span></div>
        </div>
      );
    case '06':
      return (
        <div className="board-visual visual-samples" aria-label="عينات حول حيد نشط">
          <span>أقدم</span><i /><strong>أحدث<small>عند الحيد</small></strong><i /><span>أقدم</span>
        </div>
      );
    case '01':
    default:
      return (
        <div className="board-visual visual-coasts" aria-label="مقارنة أفريقيا وأمريكا الجنوبية">
          <div className="coast america"><i /><span>أمريكا الجنوبية</span></div>
          <div className="coast-question"><b>؟</b><span>تشابه يفتح سؤالًا، مش إثبات لوحده</span></div>
          <div className="coast africa"><i /><span>أفريقيا</span></div>
        </div>
      );
  }
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
  const [reviewLogs, setReviewLogs] = useState<SessionLogEvent[]>([]);
  const [copiedLog, setCopiedLog] = useState(false);
  const [drawer, setDrawer] = useState<DrawerMode>('closed');

  const connected = status === 'listening' || status === 'speaking';

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    let disposed = false;
    const unsubscribeLogs = subscribeSessionLog((entry) => {
      if (!isReviewEvent(entry)) return;
      setReviewLogs((current) => [...current, entry]);
    });

    const controller = new NovaLessonController({
      container,
      lesson: earthLesson,
      transparent: true,
      onStatus: setStatus,
      onInputTranscript: setInputTranscript,
      onOutputTranscript: setOutputTranscript,
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

  const reviewItems = useMemo(() => buildReviewItems(reviewLogs), [reviewLogs]);
  const conversationItems = reviewItems.filter((item): item is ConversationItem => item.kind !== 'tool').slice(-12);
  const toolItems = reviewItems.filter((item): item is ToolItem => item.kind === 'tool').slice(-12);

  const understood = lessonState
    ? Object.values(lessonState.beats).filter((beat) => beat.understanding === 'understood').length
    : 0;
  const percent = Math.round((understood / earthLesson.beats.length) * 100);
  const activeBeat = earthLesson.beats.find((beat) => beat.id === lessonState?.currentBeatId) ?? earthLesson.beats[0];
  const activeBeatIndex = earthLesson.beats.findIndex((beat) => beat.id === activeBeat?.id);
  const activeBeatState = activeBeat ? lessonState?.beats[activeBeat.id] : undefined;
  const activeSectionId = activeBeat?.sectionId ?? '01';

  const connect = async () => {
    const controller = controllerRef.current;
    if (!controller || connected || status === 'connecting') return;
    setError('');
    setInputTranscript('');
    setOutputTranscript('');
    try {
      await controller.connect();
      const opener = 'ابدأ الدرس من مكاني الحالي وامشي معايا خطوة خطوة.';
      setInputTranscript(opener);
      controller.sendText(opener);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر بدء الجلسة');
    }
  };

  const disconnect = async () => {
    await controllerRef.current?.disconnect();
  };

  const sendTurn = (value: string) => {
    const clean = value.trim();
    if (!connected || !clean) return;
    setInputTranscript(clean);
    controllerRef.current?.sendText(clean);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    sendTurn(value);
    setText('');
  };

  const resetLesson = () => {
    if (connected || status === 'connecting') return;
    controllerRef.current?.resetLesson();
    setInputTranscript('');
    setOutputTranscript('');
    setReviewLogs([]);
    setDrawer('closed');
    setError('');
  };

  const copyLessonLog = async () => {
    try {
      await copyText(formatReviewLog(reviewLogs, activeBeat, understood));
      setCopiedLog(true);
      window.setTimeout(() => setCopiedLog(false), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر نسخ الـ log');
    }
  };

  const toggleDrawer = (mode: Exclude<DrawerMode, 'closed'>) => {
    setDrawer((current) => current === mode ? 'closed' : mode);
  };

  return (
    <main className="lesson-shell" dir="rtl">
      <header className="lesson-topbar">
        <div className="topbar-lesson">
          <span className="nova-wordmark">Nova</span>
          <div><small>الدرس</small><strong>{earthLesson.title}</strong></div>
        </div>

        <div className="topbar-progress">
          <div><span>{percent}%</span><small>{understood} من {earthLesson.beats.length} فكرة</small></div>
          <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
        </div>

        <div className="topbar-tools">
          <button className={drawer === 'conversation' ? 'active' : ''} type="button" onClick={() => toggleDrawer('conversation')}>المحادثة</button>
          <button className={drawer === 'diagnostics' ? 'active' : ''} type="button" onClick={() => toggleDrawer('diagnostics')}>التشخيص</button>
          <button className="reset-icon" type="button" onClick={resetLesson} disabled={connected || status === 'connecting'} title="ابدأ من الأول">↺</button>
        </div>
      </header>

      <div className="lesson-workspace">
        <aside className="nova-dock">
          <div className="nova-dock-head">
            <strong>Nova</strong>
            <span className={`live-status live-${status}`}><i />{statusLabel[status]}</span>
          </div>

          <div ref={stageRef} className="nova-stage" />

          <div className="nova-live-caption" aria-live="polite">
            <p>{outputTranscript || 'جاهزة نبدأ لما تكون جاهز.'}</p>
          </div>

          <div className="nova-session-control">
            {!connected ? (
              <button className="start-lesson" type="button" onClick={() => void connect()} disabled={status === 'connecting'}>
                {status === 'connecting' ? 'بنوصّل…' : understood > 0 ? 'كمّل الدرس' : 'ابدأ الدرس'}
              </button>
            ) : (
              <button className="end-lesson" type="button" onClick={() => void disconnect()}>إنهاء الجلسة</button>
            )}
            {error && <p className="lesson-error">{error}</p>}
          </div>
        </aside>

        <section className="learning-board">
          <div className="board-heading-row">
            <div>
              <span className="board-eyebrow">{sectionTitles[activeSectionId]} · {activeBeatIndex + 1}/{earthLesson.beats.length}</span>
              <h1>{activeBeat?.title}</h1>
              <p>{activeBeat?.objective}</p>
            </div>
            <span className={`beat-state state-${activeBeatState?.understanding ?? 'unknown'}`}>
              {understandingLabel[activeBeatState?.understanding ?? 'unknown']}
            </span>
          </div>

          <div className="learning-canvas">
            <BoardVisual sectionId={activeSectionId} />
          </div>

          <div className="current-question">
            <span>سؤال Nova</span>
            <h2>{activeBeat?.check}</h2>
          </div>

          <div className="board-bottom">
            <form className="lesson-composer" onSubmit={submit}>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={connected ? 'اسأل، جاوب، أو قول اللي مش واضح…' : 'ابدأ الجلسة عشان تتكلم مع Nova'}
                disabled={!connected}
              />
              <button type="submit" disabled={!connected || !text.trim()}>إرسال</button>
            </form>

            <div className="board-actions">
              <button type="button" disabled={!connected} onClick={() => sendTurn('بسّطلي الفكرة الحالية أكتر.')}>بسّطها</button>
              <button type="button" disabled={!connected} onClick={() => sendTurn('اديني مثال بسيط على الفكرة الحالية.')}>مثال</button>
              <button type="button" disabled={!connected} onClick={() => sendTurn('اختبرني بسؤال قصير في الفكرة الحالية.')}>اختبرني</button>
              {inputTranscript && <span>آخر رد: {inputTranscript}</span>}
            </div>
          </div>
        </section>

        <aside className="lesson-rail">
          <div className="rail-title"><small>المسار</small><strong>{understood}/{earthLesson.beats.length}</strong></div>
          <nav className="rail-nav" aria-label="أقسام الدرس">
            {sections.map(([sectionId, beats]) => {
              const completed = beats.filter((beat) => lessonState?.beats[beat.id]?.understanding === 'understood').length;
              const complete = completed === beats.length;
              const active = sectionId === activeSectionId;
              return (
                <div key={sectionId} className={`rail-item ${complete ? 'done' : ''} ${active ? 'active' : ''}`}>
                  <span className="rail-dot">{complete ? '✓' : sectionId}</span>
                  <div><strong>{sectionTitles[sectionId]}</strong><small>{completed}/{beats.length}</small></div>
                  {active && (
                    <div className="rail-current-beats">
                      {beats.map((beat) => {
                        const state = lessonState?.beats[beat.id]?.understanding ?? 'unknown';
                        const current = beat.id === activeBeat?.id;
                        return <span key={beat.id} className={`${current ? 'current' : ''} ${state === 'understood' ? 'done' : ''}`}>{beat.title}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      </div>

      {drawer !== 'closed' && (
        <section className="lesson-drawer">
          <div className="drawer-head">
            <strong>{drawer === 'conversation' ? 'المحادثة' : 'التشخيص'}</strong>
            <button type="button" onClick={() => setDrawer('closed')}>إغلاق</button>
          </div>

          {drawer === 'conversation' ? (
            <div className="conversation-history">
              {conversationItems.length ? conversationItems.map((item, index) => (
                <article key={`${item.kind}-${index}`} className={`history-turn ${item.kind}`}>
                  <b>{item.kind === 'student' ? 'أنت' : 'Nova'}</b>
                  <p>{item.text}</p>
                </article>
              )) : <p className="drawer-empty">المحادثة هتظهر هنا بعد ما تبدأ.</p>}
            </div>
          ) : (
            <div className="diagnostics-view">
              <div className="diagnostic-actions">
                <button type="button" onClick={() => void copyLessonLog()} disabled={!reviewLogs.length}>
                  {copiedLog ? '✓ اتنسخ — ابعتهولي' : 'نسخ المحادثة + tool calls'}
                </button>
                <button type="button" onClick={() => setReviewLogs([])} disabled={!reviewLogs.length}>مسح</button>
              </div>
              <div className="tool-stream">
                {toolItems.length ? toolItems.map((item, index) => (
                  <article key={`${item.name}-${index}`}>
                    <strong>{item.name}</strong>
                    <code>{JSON.stringify(item.args)}</code>
                  </article>
                )) : <p className="drawer-empty">لسه مفيش tool calls في الجلسة.</p>}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
