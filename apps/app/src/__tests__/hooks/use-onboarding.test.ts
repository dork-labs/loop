// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '@/hooks/use-onboarding';

const STORAGE_KEY = 'loop:onboarding';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default state when localStorage is empty', () => {
    const { result } = renderHook(() => useOnboarding(0));

    expect(result.current.state).toEqual({
      welcomed: false,
      completedAt: null,
      agentSource: null,
      agentSetupDismissed: false,
    });
    expect(result.current.isOnboarding).toBe(false);
  });

  it('restores stored state from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ welcomed: true, completedAt: '2026-01-01T00:00:00.000Z' })
    );

    const { result } = renderHook(() => useOnboarding(0));

    expect(result.current.state).toEqual({
      welcomed: true,
      completedAt: '2026-01-01T00:00:00.000Z',
      agentSource: null,
      agentSetupDismissed: false,
    });
  });

  it('markWelcomed sets welcomed to true', () => {
    const { result } = renderHook(() => useOnboarding(0));

    act(() => {
      result.current.markWelcomed();
    });

    expect(result.current.state.welcomed).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      welcomed: true,
    });
  });

  it('markComplete sets completedAt to an ISO timestamp', () => {
    const { result } = renderHook(() => useOnboarding(0));

    act(() => {
      result.current.markComplete();
    });

    expect(result.current.state.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('isOnboarding is true when welcomed, not completed, and issueCount is 0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ welcomed: true, completedAt: null }));

    const { result } = renderHook(() => useOnboarding(0));

    expect(result.current.isOnboarding).toBe(true);
  });

  it('isOnboarding is false when issueCount > 0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ welcomed: true, completedAt: null }));

    const { result } = renderHook(() => useOnboarding(5));

    expect(result.current.isOnboarding).toBe(false);
  });

  it('isOnboarding is false when completedAt is set', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ welcomed: true, completedAt: '2026-01-01T00:00:00.000Z' })
    );

    const { result } = renderHook(() => useOnboarding(0));

    expect(result.current.isOnboarding).toBe(false);
  });

  it('returns default state when localStorage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{{not-valid-json');

    const { result } = renderHook(() => useOnboarding(0));

    expect(result.current.state).toEqual({
      welcomed: false,
      completedAt: null,
      agentSource: null,
      agentSetupDismissed: false,
    });
    expect(result.current.isOnboarding).toBe(false);
  });

  it('state includes agentSource and agentSetupDismissed with defaults', () => {
    const { result } = renderHook(() => useOnboarding(0));
    expect(result.current.state.agentSource).toBeNull();
    expect(result.current.state.agentSetupDismissed).toBe(false);
  });

  it('setAgentSource persists to localStorage and triggers re-render', () => {
    const { result } = renderHook(() => useOnboarding(0));
    act(() => {
      result.current.setAgentSource('cursor');
    });
    expect(result.current.state.agentSource).toBe('cursor');
    const stored = JSON.parse(localStorage.getItem('loop:onboarding')!);
    expect(stored.agentSource).toBe('cursor');
  });

  it('backward compatibility: old localStorage format parses safely', () => {
    localStorage.setItem('loop:onboarding', JSON.stringify({ welcomed: true, completedAt: null }));
    const { result } = renderHook(() => useOnboarding(0));
    expect(result.current.state.agentSource).toBeNull();
    expect(result.current.state.agentSetupDismissed).toBe(false);
    expect(result.current.state.welcomed).toBe(true);
  });
});
