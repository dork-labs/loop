import { useState } from 'react';

/** Known agent sources that can trigger Loop. */
export type AgentSource = 'loop-connect' | 'cursor' | 'claude-code' | 'openhands';

const VALID_SOURCES = new Set<AgentSource>(['loop-connect', 'cursor', 'claude-code', 'openhands']);
const STORAGE_KEY = 'loop:agent-source';

/**
 * Detects the agent source via a priority chain:
 * `?from=` URL param > localStorage > `document.referrer` > null.
 *
 * Returns `null` when no valid agent source can be determined.
 */
export function detectAgentSource(): AgentSource | null {
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  if (from && VALID_SOURCES.has(from as AgentSource)) return from as AgentSource;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_SOURCES.has(stored as AgentSource)) return stored as AgentSource;
  } catch {}

  try {
    if (document.referrer.includes('cursor.com')) return 'cursor';
  } catch {}

  return null;
}

/**
 * Detects and persists the agent source for the current session.
 *
 * Runs detection once on mount via the `useState` initializer and writes the
 * result to localStorage so future visits without the `?from=` param retain
 * the original source. Returns a stable value for the component lifetime.
 */
export function useAgentDetection(): AgentSource | null {
  const [source] = useState<AgentSource | null>(() => {
    const detected = detectAgentSource();
    if (detected) {
      try {
        localStorage.setItem(STORAGE_KEY, detected);
      } catch {}
    }
    return detected;
  });
  return source;
}
