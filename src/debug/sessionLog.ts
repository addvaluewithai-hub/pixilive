export type SessionLogCategory = 'session' | 'user' | 'gemini' | 'tool' | 'audio' | 'character' | 'error';

export interface SessionLogEvent {
  id: number;
  at: number;
  wallTime: string;
  category: SessionLogCategory;
  event: string;
  data?: Record<string, unknown>;
}

type Listener = (entry: SessionLogEvent) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export function emitSessionLog(
  category: SessionLogCategory,
  event: string,
  data?: Record<string, unknown>,
) {
  const entry: SessionLogEvent = {
    id: nextId++,
    at: performance.now(),
    wallTime: new Date().toISOString(),
    category,
    event,
    data,
  };
  for (const listener of listeners) listener(entry);
  return entry;
}

export function subscribeSessionLog(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function formatSessionLog(entries: SessionLogEvent[]) {
  if (!entries.length) return 'PixiLive session log is empty.';
  const start = entries[0].at;
  return entries
    .map((entry) => {
      const elapsed = Math.round(entry.at - start).toString().padStart(6, ' ');
      const data = entry.data && Object.keys(entry.data).length
        ? ` ${JSON.stringify(entry.data)}`
        : '';
      return `+${elapsed} ms  ${entry.category.toUpperCase().padEnd(9)} ${entry.event}${data}`;
    })
    .join('\n');
}

export function exportSessionLog(entries: SessionLogEvent[]) {
  return {
    app: 'PixiLive',
    exportedAt: new Date().toISOString(),
    note: 'Secrets, ephemeral tokens and raw audio payloads are intentionally excluded.',
    entries: entries.map((entry, index) => ({
      ...entry,
      elapsedMs: Math.round(entry.at - (entries[0]?.at ?? entry.at)),
      sequence: index + 1,
    })),
  };
}
