import type { FlightCommand } from './core/flight';
import { useEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties } from 'react';
import { characters, getCharacter } from './core/registry';
import { loadCharacterEngine, portrait, SvgCharacter } from './core/SvgCharacter';
import { SessionController, initialSessionView } from './core/SessionController';
import { expressions, type Expression, type Gesture } from './core/types';
const traceLabels = {completed:'وصل للوجهة',received:'وصل',scheduled:'اتحدد توقيته',applied:'وصل للمحرّك',cancelled:'اتلغى',skipped:'اتخطّى',rejected:'غير صالح'};
const labels: Record<Expression, string> = { neutral: 'هادي', happy: 'مبسوط', sad: 'زعلان', crying: 'بيعيّط', surprised: 'متفاجئ', thinking: 'بيفكّر', angry: 'متعصّب', sleepy: 'نعسان', laughing: 'بيضحك', excited: 'متحمّس' };
export function App() {
  const [id, setId] = useState('hakim');
  const [flight, setFlight] = useState<FlightCommand>({action:'move',x:.5,y:.3,speed:.5,path:'arc'});
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof loadCharacterEngine>> | null>(null);
  const [view, setView] = useState(initialSessionView);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const [expression, setExpression] = useState<Expression>('neutral');
  const [showControls, setShowControls] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<SessionController | null>(null);
  const character = getCharacter(id);
  const portraits = useMemo(() => engine ? Object.fromEntries(characters.map(c => [c.id, portrait(engine, c)])) : {}, [engine]);
  useEffect(() => {
    let disposed = false;
    const controller = new SessionController(next => { if (!disposed) setView(next); }); session.current = controller;
    void loadCharacterEngine().then(next => { if (!disposed) setEngine(next); }).catch(e => { if (!disposed) setLoadError(String(e.message)); });
    return () => { disposed = true; controller.dispose(); session.current = null; };
  }, []);
  useEffect(() => {
    if (!engine || !host.current || !session.current) return;
    try { session.current.attach(new SvgCharacter(host.current, engine, character), {name:character.name,species:character.species,canFly:character.canFly}); setExpression('neutral'); }
    catch(error) { setLoadError(error instanceof Error ? error.message : 'تعذّر عرض الشخصية.'); }
  }, [engine, character]);
  const copyLog = async () => {
    const content = session.current?.exportLog();
    if (!content) return;
    try { await navigator.clipboard.writeText(content); setCopyStatus('اتنسخ السجل'); setCopyFallback(''); }
    catch { setCopyStatus('النسخ التلقائي متاحش؛ انسخ النص من هنا.'); setCopyFallback(content); }
  };
  const connected = view.connection === 'connected';
  const busy = view.connection === 'connecting';
  const mode = view.demo ? 'عرض الحركات — بدون صوت' : busy ? 'بنوصّل المحادثة…' : connected ? ({ idle: 'جاهز', listening: 'سامعك…', thinking: 'لحظة…', speaking: 'بيتكلم معاك' }[view.mode]) : 'جاهز للكلام';
  const submit = (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; session.current?.send(text); setText(''); };
  const cue = (value: Expression, gesture: Gesture = 'none') => { setExpression(value); session.current?.manual(value, gesture); };
  return <main className="studio" dir="rtl" style={{ '--character-accent': character.accent } as CSSProperties}>
    <header className="topbar"><a className="wordmark" href="/" aria-label="PixiLive"><span className="brand-symbol">p</span>pixilive<span className="edition">CHARACTER ENGINE</span></a><span className="session-indicator">{connected ? 'المحادثة شغالة' : busy ? 'جارٍ الاتصال' : 'مساحتك للكلام'}</span></header>
    <div className="workspace">
      <aside className="character-panel"><span className="overline">اختار صاحبك</span><h1>مين معاك<br />النهارده؟</h1><p className="panel-copy">نفس المحادثة، وش جديد.<br />بدّل بينهم في أي وقت.</p>
        <div className="character-list" role="group" aria-label="الشخصيات">{characters.map(c => <button type="button" className={`character-card ${id === c.id ? 'selected' : ''}`} aria-pressed={id === c.id} key={c.id} onClick={() => setId(c.id)}>
          <span className="portrait">{engine && <img src={portraits[c.id]} alt="" />}</span><span><strong>{c.name}</strong><small>{c.description}</small></span><span className="selection-mark" aria-hidden="true">{id === c.id ? '✓' : ''}</span>
        </button>)}</div>
        <div className="panel-note"><span>01 — {String(characters.length).padStart(2,'0')}</span><p>أصحاب على الأرض وفي السما.<br />ومكان لحكايات كتير.</p></div>
      </aside>
      <section className="stage-panel" aria-label="مساحة الشخصية">
        <div className="stage-heading"><div><span className="overline">معاك دلوقتي</span><h2>{character.name}</h2></div><span className={`mode-pill ${connected ? 'live' : ''}`} role="status">{mode}</span></div>
        <div className={`character-scene ${character.canFly ? 'flight-scene' : character.species==='human'?'human-scene':''}`}><div className="scene-orbit" aria-hidden="true" /><div className="character-host" ref={host} />{!engine && <p className="loading">{loadError || 'بنجهّز الشخصيات…'}</p>}</div>
        {character.canFly && <fieldset className="flight-controls" disabled={!engine}><legend>خد لفة في السما</legend>
          <p>اختار المكان والمسار والسرعة، أو اطلب منه يطير بصوتك.</p>
          <div className="flight-fields">
            <label>المكان أفقيًا <output>{Math.round(flight.x*100)}%</output><input aria-label="المكان أفقيًا: صفر يسار، مئة يمين" dir="ltr" type="range" min="0" max="1" step=".05" value={flight.x} onChange={e=>setFlight({...flight,x:Number(e.target.value)})}/><small>يسار ← → يمين</small></label>
            <label>الارتفاع <output>{Math.round((1-flight.y)*100)}%</output><input aria-label="الارتفاع" dir="ltr" type="range" min="0" max="1" step=".05" value={1-flight.y} onChange={e=>setFlight({...flight,y:1-Number(e.target.value)})}/><small>واطي ← → عالي</small></label>
            <label>السرعة <output>{Math.round(flight.speed*100)}%</output><input aria-label="سرعة الطيران" dir="ltr" type="range" min=".1" max="1" step=".05" value={flight.speed} onChange={e=>setFlight({...flight,speed:Number(e.target.value)})}/><small>براحة ← → بسرعة</small></label>
          </div><div className="flight-actions"><label className="sr-only" htmlFor="flight-path">مسار الطيران</label><select id="flight-path" value={flight.path} onChange={e=>setFlight({...flight,path:e.target.value as FlightCommand['path']})}><option value="direct">مباشر</option><option value="arc">قوس لفوق</option><option value="swoop">انحناءة لتحت</option></select><button onClick={()=>session.current?.manualFlight({...flight,action:'move'})}>طير هنا ↗</button><button onClick={()=>session.current?.manualFlight({...flight,action:'hover'})}>حوّم مكانك</button><button onClick={()=>session.current?.manualFlight({...flight,action:'land'})}>انزل بهدوء</button></div>
        </fieldset>}
        <div className="stage-caption"><span className="sound-bars" aria-hidden="true">{[.4,.8,1,.65,.35].map((v,i) => <i key={i} style={{ height: `${5 + view.energy * 40 * v}px` }} />)}</span><span>{connected ? 'اتكلم بطبيعتك. تقدر تقاطعه في أي وقت.' : 'ابدأ محادثة، أو جرّب تعبيراته الأول.'}</span></div>
        <div className="conversation-controls"><button className={`talk-button ${connected || busy ? 'end' : ''}`} disabled={!engine} onClick={() => { if (connected || busy) void session.current?.stop(); else void session.current?.start(); }}>{busy ? 'إلغاء الاتصال' : connected ? 'إنهاء المحادثة' : 'ابدأ الكلام'}<span aria-hidden="true">{connected || busy ? '■' : '◉'}</span></button>
          <button className="secondary-button" disabled={!engine} onClick={() => { if (view.demo) session.current?.interrupt(); else void session.current?.demo(); }}>{view.demo ? 'إيقاف العرض' : 'جرّب الحركات'}</button>
          {(connected || view.demo) && <button className="interrupt-button" onClick={() => session.current?.interrupt()}>اسمعني</button>}
        </div>
        {(view.error || loadError) && <p className="error" role="alert">{view.error || loadError}</p>}
        <button className="controls-toggle" aria-expanded={showControls} onClick={() => setShowControls(!showControls)}>تعبيرات وحركات <span aria-hidden="true">{showControls ? '−' : '+'}</span></button>
        {showControls && <div className="expression-controls"><div className="expression-grid">{expressions.map(value => <button disabled={!engine} key={value} aria-pressed={expression === value} onClick={() => cue(value)}>{labels[value]}</button>)}</div><div className="gesture-row">{([['wave','سلّم'],['jump','انط'],['blink','ارمش'],['explain','اشرح'],['think','فكّر'],['celebrate','احتفل']] as [Gesture,string][]).map(([gesture,label]) => <button disabled={!engine} key={gesture} onClick={() => cue(expression,gesture)}>{label}</button>)}</div></div>}
      </section>
      <aside className="conversation-panel"><div className="conversation-heading"><button className="copy-log-button" type="button" onClick={() => void copyLog()}>نسخ السجل</button><span className="overline">بينكم</span><h2>الكلام اللي اتقال</h2></div><span className="copy-log-status" role="status">{copyStatus}</span>{copyFallback && <textarea className="copy-log-fallback" aria-label="سجل المحادثة للنسخ" readOnly value={copyFallback} onFocus={e=>e.currentTarget.select()} />}<div className="transcript" aria-live="polite" aria-atomic="false">{!view.user && !view.assistant ? <div className="empty-chat"><span aria-hidden="true">“</span><p>كل حكاية بتبدأ<br />بـ «عامل إيه؟»</p><small>كلامكم هيظهر هنا لما تبدأوا.</small></div> : <>{view.user && <div className="message user"><small>إنت</small><p>{view.user}</p></div>}{view.assistant && <div className="message assistant"><small>{character.name}</small><p>{view.assistant}</p></div>}</>}</div>
        <form className="text-input" onSubmit={submit}><label className="sr-only" htmlFor="message">رسالتك</label><input id="message" value={text} onChange={e => setText(e.target.value)} disabled={!connected} placeholder={connected ? 'أو اكتب له هنا…' : 'ابدأ المحادثة عشان تكتب'} /><button disabled={!connected || !text.trim()} aria-label="إرسال الرسالة">↑</button></form>
        <details className="live-test-panel"><summary>اختبار تفاعل Gemini</summary>
          <p>النموذج المطلوب: <b dir="ltr">{view.model || 'يظهر بعد بدء الاتصال'}</b></p>
          <div className="test-buttons">{character.canFly && <button disabled={!connected || view.mode==='speaking' || view.mode==='thinking'} onClick={()=>session.current?.flightTest()}>حكاية وطيران</button>}<button disabled={!connected || view.mode==='speaking' || view.mode==='thinking'} onClick={() => session.current?.storyTest()}>اقرأ القصة كاملة</button><button disabled={!connected} onClick={() => session.current?.send('اعمل وش تفكير دلوقتي باستخدام حركة التفكير، واثبت عليه أربع ثواني.')}>اطلب وش تفكير</button></div>
          <p>قصة مكتوبة من 30 جملة، وحركة في كل جملتين. دي طلبات لـGemini نفسه. العرض الصامت والأزرار اليدوية مش محسوبين هنا.</p>
          <p>أوامر وصلت: <b>{view.toolReceived}</b> · اتبعتت للمحرّك: <b>{view.toolApplied}</b></p>
          <p className="test-hint">لو العدّاد فضل صفر بعد الرد، الموديل ما بعتش أداة. التنفيذ في السجل يثبت وصول الأمر للمحرّك؛ راقب الشخصية عشان تحكم على الحركة والتوقيت.</p>
          <ol className="tool-trace">{view.toolTrace.slice(-12).reverse().map((entry,i)=><li key={`${entry.turn}-${entry.id}-${i}`}><code dir="ltr">{entry.expression} / {entry.gesture}</code><span>{traceLabels[entry.status]}</span><small dir="ltr">{entry.reason}</small></li>)}</ol>
        </details>
        <p className="privacy-note">الميكروفون بيشتغل بس لما تبدأ المحادثة.</p>
      </aside>
    </div><footer><span>PIXI / LIVE</span><span>شخصيات ليها روح.</span></footer>
  </main>;
}
