import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'loop:onboarding';

interface OnboardingState {
  welcomed: boolean;
  completedAt: string | null;
}

interface UseOnboardingReturn {
  state: OnboardingState;
  /** True when user has been welcomed but hasn't received first issue yet. */
  isOnboarding: boolean;
  /** Mark the welcome modal as dismissed. */
  markWelcomed: () => void;
  /** Mark onboarding as complete with current timestamp. */
  markComplete: () => void;
}

const DEFAULT_STATE: OnboardingState = { welcomed: false, completedAt: null };

// Cache the last raw string and parsed result so useSyncExternalStore
// receives a referentially stable snapshot when the data hasn't changed.
let cachedRaw: string | null = null;
let cachedState: OnboardingState = DEFAULT_STATE;

function getState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    if (raw === cachedRaw) return cachedState;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    cachedRaw = raw;
    cachedState = {
      welcomed: parsed.welcomed === true,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
    };
    return cachedState;
  } catch {
    return DEFAULT_STATE;
  }
}

function setState(next: OnboardingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Dispatch storage event so useSyncExternalStore picks up the change
  window.dispatchEvent(new Event('onboarding-change'));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('onboarding-change', callback);
  return () => window.removeEventListener('onboarding-change', callback);
}

/**
 * Manages FTUE onboarding state backed by localStorage.
 *
 * @param issueCount - Current number of issues (0 means still onboarding)
 */
export function useOnboarding(issueCount: number): UseOnboardingReturn {
  const state = useSyncExternalStore(subscribe, getState, () => DEFAULT_STATE);

  const isOnboarding = state.welcomed && !state.completedAt && issueCount === 0;

  const markWelcomed = useCallback(() => {
    setState({ ...getState(), welcomed: true });
  }, []);

  const markComplete = useCallback(() => {
    setState({ ...getState(), completedAt: new Date().toISOString() });
  }, []);

  return { state, isOnboarding, markWelcomed, markComplete };
}
