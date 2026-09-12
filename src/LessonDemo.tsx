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
  if (entry.category === 'user') {
    return entry.event === 'text_sent' || entry.event === 'transcript';
  }

  if (entry.category === 'gemini') {
    return entry.event === 'first_output_transcript' || entry.event === 'output_transcript';
  }

  if (entry.category === 'tool') {
    if (entry.event === 'lesson_tool_response' || entry.event === 'google_search_activity') return true;
    if (entry.event !== 'call_received') return false;
    return entry.data?.name !== 'direct_character';
  }

  return false;
}

function mergeTranscript(current: string, incoming: string) {
  const left = current.replace(/\s+/g, ' ').trim();
  const right = incoming.replace(/\s+/g, ' ').trim();
  if (!left) return right;
  if (!right || left === right || left.endsWith(right)) return left;
  if (right.startsWith(left)) return right;

  const maxOverlap = Math.min(80, left.length, right.length);
  for (let overlap = maxOverlap; overlap >= 3; overlap -= 1) {
    if (left.slice(-overlap) === right.slice(0, overlap)) {
      return `${left}${right.slice(overlap)}`;
    }
  }

  const needsSpace = !/[\s،,.!?؟:؛]$/.test(left) && !/^[\s،,.!?؟:؛]/.test(right);
  return `${left}${needsSpace ? ' ' : ''}${right}`;
}

function compactSearchDetail(value: unknown) {
  if (typeof value !== 'string') return value;
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > 600 ? `${oneLine.slice(0, 600)}…` : oneLine;
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

    if (entry.category === 'tool' && entry.event === 'google_search_activity') {
      const phase = typeof entry.data?.phase === 'string' ? entry.data.phase : 'activity';
      const detail = phase === 'query' ? entry.data?.code : entry.data?.output;
      items.push({
        kind: 'tool',
        name: `google_search:${phase}`,
        args: { detail: compactSearchDetail(detail) },
        response: phase === 'result' ? 'server-side search result observed' : undefined,
      });
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

function formatReviewLog(
  entries: SessionLogEvent[],
  activeBeat: EarthBeat | undefined,
  understood: number,
) {
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
        <div className="board-visual visual-layers" aria-label="رسم توضيحي للصفيحة والوشاح">
          <div className="layer-chip crust-chip">قشرة</div>
          <div className="layer-plate">
            <strong>الصفيحة</strong>
            <span>القشرة + الجزء العلوي الصلب من الوشاح</span>
          </div>
          <div className="layer-mantle">
            <strong>الوشاح</strong>
            <span>صلب في معظمه · يتشوه ببطء شديد</span>
          </div>
        </div>
      );
    case '03':
      return (
        <div className="board-visual visual-ridge" aria-label="رسم توضيحي لحيد وسط المحيط">
          <div className="ridge-arrow ridge-left">←</div>
          <div className="ridge-floor"><span>أقدم</span><i /><span>أحدث</span></div>
          <div className="ridge-core"><b>حيد</b><small>قشرة جديدة</small></div>
          <div className="ridge-floor ridge-floor-right"><span>أحدث</span><i /><span>أقدم</span></div>
          <div className="ridge-arrow ridge-right">→</div>
        </div>
      );
    case '04':
      return (
        <div className="board-visual visual-boundaries" aria-label="أنواع حركة حدود الصفائح">
          <div><b>← →</b><span>تباعد</span></div>
          <div><b>→ ←</b><span>تقارب</span></div>
          <div><b>⇄</b><span>تحويلي</span></div>
        </div>
      );
    case '05':
      return (
        <div className="board-visual visual-time" aria-label="تراكم الحركة عبر الزمن">
          <div className="time-rate"><strong>3 سم</strong><span>كل سنة</span></div>
          <div className="time-flow">×</div>
          <div className="time-years"><strong>1,000,000</strong><span>سنة</span></div>
          <div className="time-equals">=</div>
          <div className="time-result"><strong>30 كم</strong><span>في المثال</span></div>
        </div>
      );
    case '06':
      return (
        <div className="board-visual visual-samples" aria-label="عينات صخور حول حيد نشط">
          <span className="sample-old">أقدم</span>
          <i className="sample-line" />
          <strong>أحدث<br /><small>عند الحيد</small></strong>
          <i className="sample-line" />
          <span className="sample-old">أقدم</span>
        </div>
      );
    case '01':
    default:
      return (
        <div className="board-visual visual-coasts" aria-label="مقارنة شكل ساحلي أفريقيا وأمريكا الجنوبية">
          <div className="coast-piece coast-america"><span>أمريكا الجنوبية</span><i /></div>
          <div className="coast-question"><b>؟</b><span>تشابه يفتح سؤالًا<br />مش إثبات لوحده</span></div>
          <div className="coast-piece coast-africa"><i /><span>أفريقيا</span></div>
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

  const reviewItems = useMemo(() => buildReviewItems(reviewLogs), [reviewLogs]);
  const conversationItems = reviewItems.filter((item) => item.kind !== 'tool').slice(-8);
  const toolItems = reviewItems.filter((item) => item.kind === 'tool').slice(-8);

  const understood = lessonState
    ? Object.values(lessonState.beats).filter((beat) => beat.understanding === 'understood').length
    : 0;
  const percent = Math.round((understood / earthLesson.beats.length) * 100);
  const activeBeat = earthLesson.beats.find((beat) => beat.id === lessonState?.currentBeatId) ?? earthLesson.beats[0];
  const activeBeatIndex = earthLesson.beats.findIndex((beat) => beat.id === activeBeat?.id);
  const activeBeatState = activeBeat ? lessonState?.beats[activeBeat.id] : undefined;
  const activeSectionId = activeBeat?.sectionId ?? '01';
  const activeSection = sections.find(([sectionId]) => sectionId === activeSectionId);
  const activeSectionIndex = Math.max(0, sections.findIndex(([sectionId]) => sectionId === activeSectionId));
  const activeDetour = lessonState?.detours.at(-1) ?? null;

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
      <header className="lesson-header">
        <div className="lesson-brand">
          <span className="lesson-brand-mark">N</span>
          <div>
            <small>منهج الإنسان · Nova Live</small>
            <strong>{earthLesson.title}</strong>
          </div>
        </div>

        <div className="header-current">
          <small>إحنا هنا</small>
          <strong>{activeBeat?.title ?? 'بداية الدرس'}</strong>
          <span>{sectionTitles[activeSectionId]} · فكرة {activeBeatIndex + 1} من {earthLesson.beats.length}</span>
        </div>

        <div className="header-progress">
          <div><span>{understood}/{earthLesson.beats.length}</span><b>{percent}%</b></div>
          <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
        </div>
      </header>

      <div className="lesson-workspace">
        <aside className="nova-panel">
          <div className="nova-topbar">
            <div className="nova-name"><i /> Nova</div>
            <span className={`live-status live-${status}`}>{statusLabel[status]}</span>
          </div>

          <div ref={stageRef} className="nova-stage" />

          <div className="nova-caption" aria-live="polite">
            <small>{status === 'speaking' ? 'Nova بتقول' : 'آخر كلام'}</small>
            <p>{outputTranscript || 'أنا هنا جنبك. اللوحة في النص هي مساحة الشرح والنشاط.'}</p>
          </div>

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
                placeholder={connected ? 'اسأل Nova أو اكتب اللي مش واضح…' : 'ابدأ الجلسة الأول'}
                disabled={!connected}
              />
              <button type="submit" disabled={!connected || !text.trim()}>إرسال</button>
            </form>

            {activeDetour && (
              <p className="detour-note">سؤال جانبي مفتوح: {activeDetour.topic}</p>
            )}
            {error && <p className="lesson-error">{error}</p>}
          </div>
        </aside>

        <section className="learning-board">
          <div className="board-topline">
            <div className="board-location">
              <span>القسم {activeSectionId}</span>
              <b>{sectionTitles[activeSectionId]}</b>
            </div>
            <span className={`beat-state state-${activeBeatState?.understanding ?? 'unknown'}`}>
              {understandingLabel[activeBeatState?.understanding ?? 'unknown']}
            </span>
          </div>

          <div className="board-heading">
            <small>الفكرة الحالية</small>
            <h1>{activeBeat?.title}</h1>
            <p>{activeBeat?.objective}</p>
          </div>

          <BoardVisual sectionId={activeSectionId} />

          <div className="board-content-grid">
            <article className="board-script-card">
              <div className="board-card-label"><i /> على السبورة</div>
              <p>{activeBeat?.script}</p>
            </article>

            <article className="board-check-card">
              <div className="board-card-label"><i /> دورك</div>
              <h2>{activeBeat?.check}</h2>
              <p>جاوب بطريقتك. Nova هتثبت الفكرة الأول قبل ما تنقلك للي بعدها.</p>
            </article>
          </div>

          <div className="board-actions">
            <span>محتاج حاجة مختلفة؟</span>
            <button type="button" disabled={!connected} onClick={() => sendTurn('بسّطلي الفكرة الحالية أكتر من غير ما تنتقل للي بعدها.')}>بسّطها</button>
            <button type="button" disabled={!connected} onClick={() => sendTurn('اديني مثال بسيط من نفس محتوى الدرس على الفكرة الحالية.')}>مثال</button>
            <button type="button" disabled={!connected} onClick={() => sendTurn('اختبرني في الفكرة الحالية بسؤال قصير من غير ما تنتقل للي بعدها.')}>اختبرني</button>
          </div>
        </section>

        <aside className="lesson-rail">
          <div className="rail-head">
            <div>
              <small>مسار الدرس</small>
              <strong>{activeSectionIndex + 1} / {sections.length}</strong>
            </div>
            <span>{understood} فكرة اتثبتت</span>
          </div>

          <div className="rail-sections">
            {sections.map(([sectionId, beats]) => {
              const completed = beats.filter((beat) => lessonState?.beats[beat.id]?.understanding === 'understood').length;
              const complete = completed === beats.length;
              const active = sectionId === activeSectionId;
              return (
                <div key={sectionId} className={`rail-section ${complete ? 'done' : ''} ${active ? 'active' : ''}`}>
                  <div className="rail-section-head">
                    <i>{complete ? '✓' : sectionId}</i>
                    <div><strong>{sectionTitles[sectionId]}</strong><span>{completed}/{beats.length}</span></div>
                  </div>

                  {active && (
                    <div className="rail-beats">
                      {beats.map((beat) => {
                        const state = lessonState?.beats[beat.id]?.understanding ?? 'unknown';
                        const current = beat.id === activeBeat?.id;
                        return (
                          <div key={beat.id} className={`rail-beat ${current ? 'current' : ''} ${state === 'understood' ? 'done' : ''}`}>
                            <span>{state === 'understood' ? '✓' : '•'}</span>
                            <b>{beat.title}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rail-footer">
            <p>الخطوات بتتفتح بالترتيب. Nova تقدر تبسّط وتجاوب، لكن ما تنطّش خطوة.</p>
            <button className="reset-progress" type="button" onClick={resetLesson} disabled={connected || status === 'connecting'}>
              ابدأ الدرس من الأول
            </button>
          </div>
        </aside>
      </div>

      <section className={`lesson-drawer-shell ${drawer === 'closed' ? 'is-closed' : ''}`}>
        <div className="drawer-tabs">
          <div className="drawer-tab-group">
            <button className={drawer === 'conversation' ? 'active' : ''} type="button" onClick={() => toggleDrawer('conversation')}>
              المحادثة
              {conversationItems.length ? <span>{conversationItems.length}</span> : null}
            </button>
            <button className={drawer === 'diagnostics' ? 'active' : ''} type="button" onClick={() => toggleDrawer('diagnostics')}>
              التشخيص
              {toolItems.length ? <span>{toolItems.length}</span> : null}
            </button>
          </div>
          <p>مساحة ثانوية عشان الـ board تفضل هي مركز التجربة.</p>
        </div>

        {drawer === 'conversation' && (
          <div className="drawer-content conversation-history">
            {conversationItems.length ? conversationItems.map((item, index) => (
              <article key={`${item.kind}-${index}`} className={`history-turn ${item.kind}`}>
                <b>{item.kind === 'student' ? 'أنت' : 'Nova'}</b>
                <p>{item.text}</p>
              </article>
            )) : <p className="drawer-empty">المحادثة هتظهر هنا بعد ما تبدأ.</p>}
          </div>
        )}

        {drawer === 'diagnostics' && (
          <div className="drawer-content diagnostics-drawer">
            <div className="lesson-diagnostics">
              <button className="copy-lesson-log" type="button" onClick={() => void copyLessonLog()} disabled={!reviewLogs.length}>
                {copiedLog ? '✓ اتنسخ — ابعتهولي' : 'نسخ المحادثة + tool calls'}
              </button>
              <button className="clear-lesson-log" type="button" onClick={() => setReviewLogs([])} disabled={!reviewLogs.length}>
                مسح
              </button>
              <p>مختصر للمراجعة: كلام الطالب وNova + lesson tools + أي Google Search.</p>
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
    </main>
  );
}
