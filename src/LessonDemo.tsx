import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeSessionLog, type SessionLogEvent } from './debug/sessionLog';
import { findLesson, lessonCatalog } from './lesson/catalog';
import type { LessonBeat, LessonBoard, LessonDefinition, LessonState } from './lesson/types';
import type { LiveStatus } from './live/types';
import { NovaLessonController } from './sdk/NovaLessonController';
import './lesson-demo.css';

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

const understandingLabel = {
  unknown: 'لسه بنبدأ',
  struggling: 'محتاج تبسيط',
  partial: 'قربنا',
  understood: 'اتثبتت',
} as const;

const imageSceneIcon: Record<string, string> = {
  fossil: '🦴',
  pangaea: '🌍',
  mountains: '⛰️',
  gps: '🛰️',
  recipe: '🥣',
  map: '🗺️',
  satellite: '🌊',
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

function formatReviewLog(
  entries: SessionLogEvent[],
  lesson: LessonDefinition,
  activeBeat: LessonBeat | undefined,
  understood: number,
) {
  const items = buildReviewItems(entries);
  const lines = [
    '# Nova lesson review log',
    `Lesson: ${lesson.title}`,
    `Curriculum: ${lesson.curriculumTitle}`,
    `Progress: ${understood}/${lesson.beats.length} understood`,
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

function CanvasSketch({ board }: { board: Extract<LessonBoard, { type: 'canvas' }> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1000;
    const height = 420;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const fillRoundRect = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
    };

    if (board.variant === 'coasts') {
      ctx.fillStyle = '#6d78c8';
      ctx.beginPath();
      ctx.moveTo(190, 105);
      ctx.bezierCurveTo(95, 130, 95, 275, 245, 310);
      ctx.bezierCurveTo(325, 328, 362, 245, 332, 175);
      ctx.bezierCurveTo(304, 112, 244, 92, 190, 105);
      ctx.fill();

      ctx.fillStyle = '#617eae';
      ctx.beginPath();
      ctx.moveTo(790, 110);
      ctx.bezierCurveTo(684, 92, 620, 155, 640, 235);
      ctx.bezierCurveTo(655, 306, 760, 329, 842, 272);
      ctx.bezierCurveTo(925, 214, 898, 130, 790, 110);
      ctx.fill();

      ctx.strokeStyle = '#9a8cff';
      ctx.lineWidth = 7;
      ctx.setLineDash([16, 18]);
      ctx.beginPath();
      ctx.moveTo(398, 210);
      ctx.lineTo(600, 210);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#514d7a';
      ctx.font = '700 60px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('؟', 500, 232);
    }

    if (board.variant === 'ridge') {
      ctx.fillStyle = '#dbe8ef';
      ctx.fillRect(0, 0, width, 200);
      ctx.fillStyle = '#91a6b8';
      ctx.fillRect(0, 200, width, 220);
      ctx.fillStyle = '#606e98';
      ctx.beginPath();
      ctx.moveTo(420, 330);
      ctx.lineTo(500, 150);
      ctx.lineTo(580, 330);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4f5d80';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(450, 350);
      ctx.lineTo(205, 350);
      ctx.moveTo(550, 350);
      ctx.lineTo(795, 350);
      ctx.stroke();
      ctx.font = '700 54px system-ui';
      ctx.fillStyle = '#526086';
      ctx.fillText('←', 240, 315);
      ctx.fillText('→', 760, 315);
    }

    if (board.variant === 'plates') {
      fillRoundRect(85, 140, 360, 120, 24, '#7688b8');
      fillRoundRect(555, 140, 360, 120, 24, '#6677a5');
      ctx.fillStyle = '#4f5a78';
      ctx.font = '700 58px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('→', 465, 218);
      ctx.fillText('→', 535, 218);
      ctx.strokeStyle = '#d0b087';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(110, 130);
      ctx.lineTo(420, 130);
      ctx.moveTo(580, 130);
      ctx.lineTo(890, 130);
      ctx.stroke();
    }

    if (board.variant === 'ratio-bars') {
      for (let i = 0; i < 2; i += 1) fillRoundRect(160 + i * 120, 120, 92, 92, 22, '#6476dd');
      for (let i = 0; i < 3; i += 1) fillRoundRect(520 + i * 120, 120, 92, 92, 22, '#9a78d8');
      ctx.fillStyle = '#525a74';
      ctx.font = '700 34px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('2', 260, 280);
      ctx.fillText(':', 500, 280);
      ctx.fillText('3', 640, 280);
    }

    if (board.variant === 'fraction-circle') {
      const drawCircle = (cx: number, filled: number, total: number) => {
        const radius = 105;
        for (let i = 0; i < total; i += 1) {
          const start = -Math.PI / 2 + (i / total) * Math.PI * 2;
          const end = -Math.PI / 2 + ((i + 1) / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, 200);
          ctx.arc(cx, 200, radius, start, end);
          ctx.closePath();
          ctx.fillStyle = i < filled ? '#7569d8' : '#d7dbea';
          ctx.fill();
          ctx.strokeStyle = '#f4f5f9';
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      };
      drawCircle(320, 1, 2);
      drawCircle(680, 2, 4);
      ctx.fillStyle = '#525a74';
      ctx.font = '700 30px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('1 / 2', 320, 355);
      ctx.fillText('2 / 4', 680, 355);
    }
  }, [board.variant]);

  return (
    <div className="board-canvas-experience">
      <canvas ref={canvasRef} aria-label={board.title ?? 'رسم توضيحي'} />
      {(board.title || board.caption) && (
        <div className="canvas-note">
          {board.title && <strong>{board.title}</strong>}
          {board.caption && <span>{board.caption}</span>}
        </div>
      )}
    </div>
  );
}

function BoardExperience({ board }: { board: LessonBoard }) {
  if (board.type === 'canvas') return <CanvasSketch board={board} />;

  if (board.type === 'text') {
    return (
      <div className="board-text-experience">
        {board.eyebrow && <small>{board.eyebrow}</small>}
        <h2>{board.headline}</h2>
        {board.body && <p>{board.body}</p>}
        {board.chips?.length ? <div className="board-chips">{board.chips.map((chip) => <span key={chip}>{chip}</span>)}</div> : null}
      </div>
    );
  }

  if (board.type === 'timeline') {
    return (
      <div className="board-timeline-experience">
        {board.title && <h2>{board.title}</h2>}
        <div className="timeline-line">
          {board.items.map((item, index) => (
            <div key={`${item.value}-${index}`} className="timeline-stop">
              <i />
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (board.type === 'image') {
    return (
      <div className={`board-image-experience scene-${board.scene}`}>
        <div className="image-art" aria-hidden="true"><span>{imageSceneIcon[board.scene] ?? '✦'}</span></div>
        <div className="image-copy"><h2>{board.title}</h2><p>{board.caption}</p></div>
      </div>
    );
  }

  if (board.type === 'compare') {
    return (
      <div className="board-compare-experience">
        <article><small>01</small><h2>{board.left.title}</h2><p>{board.left.body}</p></article>
        {board.center && <b>{board.center}</b>}
        <article><small>02</small><h2>{board.right.title}</h2><p>{board.right.body}</p></article>
      </div>
    );
  }

  if (board.type === 'equation') {
    return (
      <div className="board-equation-experience">
        <div className="equation-row">{board.parts.map((part, index) => <span key={`${part}-${index}`}>{part}</span>)}</div>
        <i>↓</i>
        <strong>{board.result}</strong>
        {board.caption && <p>{board.caption}</p>}
      </div>
    );
  }

  if (board.type === 'choices') {
    return (
      <div className="board-choices-experience">
        {board.prompt && <h2>{board.prompt}</h2>}
        <div>{board.choices.map((choice, index) => <span key={choice}><b>{index + 1}</b>{choice}</span>)}</div>
        {board.hint && <p>تلميح: {board.hint}</p>}
      </div>
    );
  }

  if (board.type === 'diagram') {
    return (
      <div className="board-diagram-experience">
        {board.title && <h2>{board.title}</h2>}
        <div className="diagram-flow">
          {board.nodes.map((node, index) => (
            <div key={`${node.title}-${index}`} className="diagram-node">
              <strong>{node.title}</strong>{node.subtitle && <span>{node.subtitle}</span>}
            </div>
          ))}
        </div>
        {board.arrows?.length ? <div className="diagram-notes">{board.arrows.map((arrow) => <span key={arrow}>{arrow}</span>)}</div> : null}
      </div>
    );
  }

  if (board.type === 'meter') {
    return (
      <div className="board-meter-experience">
        <small>{board.label}</small>
        <strong>{board.value}</strong>
        <div className="meter-track"><i /></div>
        {board.secondary && <p>{board.secondary}</p>}
      </div>
    );
  }

  return (
    <div className="board-cards-experience">
      {board.title && <h2>{board.title}</h2>}
      <div>{board.items.map((item) => <article key={item.title}><strong>{item.title}</strong><p>{item.body}</p></article>)}</div>
    </div>
  );
}

export function LessonDemo() {
  const initialLesson = findLesson(new URLSearchParams(window.location.search).get('lessonId'));
  const [lessonId, setLessonId] = useState(initialLesson.id);
  const lesson = findLesson(lessonId);

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
  const [libraryOpen, setLibraryOpen] = useState(false);

  const connected = status === 'listening' || status === 'speaking';

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    setStatus('idle');
    setLessonState(null);
    setInputTranscript('');
    setOutputTranscript('');
    setReviewLogs([]);
    setError('');

    let disposed = false;
    const unsubscribeLogs = subscribeSessionLog((entry) => {
      if (!isReviewEvent(entry)) return;
      setReviewLogs((current) => [...current, entry]);
    });

    const controller = new NovaLessonController({
      container,
      lesson,
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
  }, [lesson]);

  const sections = useMemo(() => lesson.sections.map((section) => ({
    ...section,
    beats: lesson.beats.filter((beat) => beat.sectionId === section.id),
  })), [lesson]);

  const reviewItems = useMemo(() => buildReviewItems(reviewLogs), [reviewLogs]);
  const conversationItems = reviewItems.filter((item): item is ConversationItem => item.kind !== 'tool').slice(-12);
  const toolItems = reviewItems.filter((item): item is ToolItem => item.kind === 'tool').slice(-12);

  const understood = lessonState
    ? Object.values(lessonState.beats).filter((beat) => beat.understanding === 'understood').length
    : 0;
  const percent = Math.round((understood / lesson.beats.length) * 100);
  const activeBeat = lesson.beats.find((beat) => beat.id === lessonState?.currentBeatId) ?? lesson.beats[0];
  const activeBeatIndex = lesson.beats.findIndex((beat) => beat.id === activeBeat?.id);
  const activeBeatState = activeBeat ? lessonState?.beats[activeBeat.id] : undefined;
  const activeSection = lesson.sections.find((section) => section.id === activeBeat?.sectionId) ?? lesson.sections[0];

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

  const chooseLesson = (nextLessonId: string) => {
    if (connected || status === 'connecting' || nextLessonId === lesson.id) {
      setLibraryOpen(false);
      return;
    }
    const next = findLesson(nextLessonId);
    const params = new URLSearchParams(window.location.search);
    params.set('lesson', '1');
    params.set('lessonId', next.id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    setLessonId(next.id);
    setDrawer('closed');
    setLibraryOpen(false);
  };

  const copyLessonLog = async () => {
    try {
      await copyText(formatReviewLog(reviewLogs, lesson, activeBeat, understood));
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
      <header className="product-bar">
        <div className="product-brand" dir="ltr"><strong>PixiLive</strong><span>Learn Smarter</span></div>
        <div className="product-actions">
          <button type="button" onClick={() => setLibraryOpen(true)}>المكتبة · {lesson.subject}</button>
          <button type="button" onClick={() => toggleDrawer('conversation')} className={drawer === 'conversation' ? 'active' : ''}>المحادثة</button>
          <button type="button" onClick={() => toggleDrawer('diagnostics')} className={drawer === 'diagnostics' ? 'active' : ''}>التشخيص</button>
        </div>
      </header>

      <div className="lesson-workspace">
        <aside className="nova-dock">
          <div className="nova-dock-head">
            <div><i /><strong>Nova</strong><small>{statusLabel[status]}</small></div>
          </div>
          <div ref={stageRef} className="nova-stage" />
          <div className="nova-live-caption" aria-live="polite">
            <small>{status === 'speaking' ? 'Nova بتقول' : 'آخر كلام'}</small>
            <p>{outputTranscript || 'أنا هنا جنبك — اسأل، جرّب، وقاطعني وقت ما تحب.'}</p>
          </div>
          <div className="nova-session-control">
            {!connected ? (
              <button className="start-lesson" type="button" onClick={() => void connect()} disabled={status === 'connecting'}>
                {status === 'connecting' ? 'بنجهّز Nova…' : understood > 0 ? 'كمّل الدرس' : 'ابدأ الدرس'}
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
              <span className="board-eyebrow">{activeSection?.title} · خطوة {activeBeatIndex + 1} من {lesson.beats.length}</span>
              <h1>{activeBeat?.title}</h1>
              <p>{activeBeat?.objective}</p>
            </div>
            <span className={`beat-state state-${activeBeatState?.understanding ?? 'unknown'}`}>
              {understandingLabel[activeBeatState?.understanding ?? 'unknown']}
            </span>
          </div>

          {activeBeat && <div className="learning-canvas"><BoardExperience board={activeBeat.board} /></div>}

          <div className="board-question-strip">
            <small>دورك</small>
            <strong>{activeBeat?.check}</strong>
            <span>جاوب بطريقتك — Nova هتحدد إذا نكمّل أو نبسّط نفس الفكرة.</span>
          </div>

          <div className="board-quick-actions">
            <button type="button" disabled={!connected} onClick={() => sendTurn('بسّطلي الفكرة الحالية أكتر، وخليك في نفس الخطوة.')}>بسّطها</button>
            <button type="button" disabled={!connected} onClick={() => sendTurn('اديني مثال بسيط على الفكرة الحالية.')}>مثال</button>
            <button type="button" disabled={!connected} onClick={() => sendTurn('اختبرني بسؤال قصير في الفكرة الحالية.')}>اختبرني</button>
          </div>
        </section>

        <aside className="lesson-rail">
          <div className="rail-lesson-head">
            <small>{lesson.curriculumTitle}</small>
            <h2>{lesson.title}</h2>
            {lesson.subtitle && <p>{lesson.subtitle}</p>}
          </div>

          <div className="rail-progress-line">
            <div><span>{understood} / {lesson.beats.length}</span><b>{percent}%</b></div>
            <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
          </div>

          <div className="rail-current-card">
            <small>الخطوة الحالية</small>
            <strong>{activeBeat?.title}</strong>
            <p>{activeBeat?.objective}</p>
          </div>

          <div className="rail-sections">
            {sections.map((section) => {
              const completed = section.beats.filter((beat) => lessonState?.beats[beat.id]?.understanding === 'understood').length;
              const isActive = section.id === activeBeat?.sectionId;
              const isDone = completed === section.beats.length;
              return (
                <div key={section.id} className={`rail-section ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <i>{isDone ? '✓' : section.id}</i>
                  <div><strong>{section.title}</strong><span>{completed}/{section.beats.length}</span></div>
                </div>
              );
            })}
          </div>

          <div className="rail-footer-actions">
            <button type="button" onClick={() => setLibraryOpen(true)}>تغيير الدرس</button>
            <button type="button" onClick={resetLesson} disabled={connected || status === 'connecting'}>إعادة من البداية</button>
          </div>
        </aside>
      </div>

      {drawer !== 'closed' && (
        <section className="lesson-drawer">
          <div className="drawer-head">
            <strong>{drawer === 'conversation' ? 'المحادثة' : 'التشخيص'}</strong>
            <button type="button" onClick={() => setDrawer('closed')}>إغلاق</button>
          </div>

          {drawer === 'conversation' && (
            <div className="conversation-history">
              {conversationItems.length ? conversationItems.map((item, index) => (
                <article key={`${item.kind}-${index}`} className={item.kind}>
                  <b>{item.kind === 'student' ? 'أنت' : 'Nova'}</b><p>{item.text}</p>
                </article>
              )) : <p className="drawer-empty">المحادثة هتظهر هنا بعد البداية.</p>}
            </div>
          )}

          {drawer === 'diagnostics' && (
            <div className="diagnostics-content">
              <div className="diagnostics-actions">
                <button type="button" onClick={() => void copyLessonLog()} disabled={!reviewLogs.length}>
                  {copiedLog ? '✓ اتنسخ — ابعتهولي' : 'نسخ المحادثة + tool calls'}
                </button>
                <button type="button" onClick={() => setReviewLogs([])} disabled={!reviewLogs.length}>مسح</button>
              </div>
              <div className="tool-stream">
                {toolItems.length ? toolItems.map((item, index) => (
                  <article key={`${item.name}-${index}`}><strong>{item.name}</strong><code>{JSON.stringify(item.args)}</code></article>
                )) : <p className="drawer-empty">لسه مفيش tool calls.</p>}
              </div>
            </div>
          )}
        </section>
      )}

      <form className="lesson-composer" onSubmit={submit}>
        <button className="composer-mic" type="button" aria-label="الميكروفون" disabled={!connected}>●</button>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={connected ? 'اكتب سؤالك هنا…' : 'ابدأ الجلسة الأول…'}
          disabled={!connected}
        />
        <button className="composer-send" type="submit" disabled={!connected || !text.trim()}>إرسال</button>
      </form>

      {libraryOpen && (
        <div className="lesson-library-backdrop" role="presentation" onMouseDown={() => setLibraryOpen(false)}>
          <section className="lesson-library" role="dialog" aria-modal="true" aria-label="مكتبة الدروس" onMouseDown={(event) => event.stopPropagation()}>
            <div className="library-head">
              <div><small>PixiLive Library</small><h2>اختار المنهج والدرس</h2></div>
              <button type="button" onClick={() => setLibraryOpen(false)}>×</button>
            </div>
            <div className="curriculum-groups">
              {lessonCatalog.map((curriculum) => (
                <section key={curriculum.id} className="curriculum-group">
                  <div className="curriculum-title"><div><h3>{curriculum.title}</h3><p>{curriculum.subtitle}</p></div><span>{curriculum.lessons.length} درس</span></div>
                  <div className="lesson-library-grid">
                    {curriculum.lessons.map((candidate) => {
                      const selected = candidate.id === lesson.id;
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          className={selected ? 'selected' : ''}
                          onClick={() => chooseLesson(candidate.id)}
                          disabled={(connected || status === 'connecting') && !selected}
                        >
                          <small>{candidate.subject} · {candidate.beats.length} خطوة</small>
                          <strong>{candidate.title}</strong>
                          <span>{candidate.subtitle}</span>
                          <i>{selected ? 'الدرس الحالي' : 'فتح الدرس ←'}</i>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {connected && <p className="library-session-note">اقفل الجلسة الحالية الأول قبل ما تبدّل لدرس تاني.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
