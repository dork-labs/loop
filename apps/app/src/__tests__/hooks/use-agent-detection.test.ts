// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { detectAgentSource, useAgentDetection } from '@/hooks/use-agent-detection';

const STORAGE_KEY = 'loop:agent-source';

describe('detectAgentSource', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('returns correct source for each valid ?from= value', () => {
    for (const source of ['loop-connect', 'cursor', 'claude-code', 'openhands']) {
      window.history.replaceState({}, '', `/?from=${source}`);
      expect(detectAgentSource()).toBe(source);
    }
  });

  it('returns null for unknown ?from= values', () => {
    window.history.replaceState({}, '', '/?from=unknown-agent');
    expect(detectAgentSource()).toBeNull();
  });

  it('returns null for empty ?from= param', () => {
    window.history.replaceState({}, '', '/?from=');
    expect(detectAgentSource()).toBeNull();
  });

  it('reads from localStorage when no URL param present', () => {
    localStorage.setItem(STORAGE_KEY, 'cursor');
    expect(detectAgentSource()).toBe('cursor');
  });

  it('returns null when both URL param and localStorage are empty', () => {
    expect(detectAgentSource()).toBeNull();
  });

  it('validates stored values against the allowlist', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-source');
    expect(detectAgentSource()).toBeNull();
  });

  it('URL param takes priority over localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'cursor');
    window.history.replaceState({}, '', '/?from=claude-code');
    expect(detectAgentSource()).toBe('claude-code');
  });
});

describe('useAgentDetection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('persists detected source to localStorage', () => {
    window.history.replaceState({}, '', '/?from=cursor');
    renderHook(() => useAgentDetection());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cursor');
  });

  it('returns stable value across re-renders', () => {
    window.history.replaceState({}, '', '/?from=loop-connect');
    const { result, rerender } = renderHook(() => useAgentDetection());
    const firstValue = result.current;
    rerender();
    expect(result.current).toBe(firstValue);
  });

  it('returns null when no detection signal available', () => {
    const { result } = renderHook(() => useAgentDetection());
    expect(result.current).toBeNull();
  });
});
