import { useMemo, useState } from 'react';
import { exportSessionLog, formatSessionLog, type SessionLogEvent } from '../debug/sessionLog';

interface SessionLogPanelProps {
  entries: SessionLogEvent[];
  onClear: () => void;
}

export function SessionLogPanel({ entries, onClear }: SessionLogPanelProps) {
  const [copied, setCopied] = useState(false);
  const formatted = useMemo(() => formatSessionLog(entries), [entries]);

  const copyLog = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const downloadLog = () => {
    const payload = JSON.stringify(exportSessionLog(entries), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pixilive-session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="session-log" open>
      <summary>
        <span>Session log</span>
        <em>{entries.length} events</em>
      </summary>
      <div className="session-log-actions">
        <button type="button" onClick={() => void copyLog()} disabled={!entries.length}>{copied ? 'Copied' : 'Copy log'}</button>
        <button type="button" onClick={downloadLog} disabled={!entries.length}>Download JSON</button>
        <button type="button" onClick={onClear} disabled={!entries.length}>Clear</button>
      </div>
      <p className="session-log-note">Transcripts, tool calls, tool responses, timing and character events only. No API keys, tokens or raw audio.</p>
      <div className="session-log-scroll" aria-live="polite">
        {entries.length === 0 ? (
          <p className="session-log-empty">Start a Gemini Live session to capture diagnostics.</p>
        ) : entries.map((entry) => {
          const start = entries[0]?.at ?? entry.at;
          const elapsed = Math.round(entry.at - start);
          return (
            <div className={`session-log-row log-${entry.category}`} key={entry.id}>
              <time>+{elapsed}ms</time>
              <b>{entry.category}</b>
              <span>{entry.event}</span>
              {entry.data && Object.keys(entry.data).length > 0 && <code>{JSON.stringify(entry.data)}</code>}
            </div>
          );
        })}
      </div>
    </details>
  );
}
