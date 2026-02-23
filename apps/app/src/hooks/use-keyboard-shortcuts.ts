import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';

interface UseKeyboardShortcutsOptions {
  /** Called when the user presses ? to open the help dialog. */
  onHelpOpen?: () => void;
}

/**
 * Registers app-wide keyboard shortcuts.
 *
 * Navigation shortcuts use a two-key "g then X" chord:
 * - g+i  → /issues
 * - g+a  → /activity
 * - g+g  → /goals
 * - g+p  → /prompts
 *
 * Other shortcuts:
 * - ?    → open keyboard shortcut help
 *
 * Shortcuts are suppressed when focus is inside an input, textarea, or
 * contenteditable element to avoid conflicts with typing.
 */
export function useKeyboardShortcuts({ onHelpOpen }: UseKeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();
  // Tracks if the "g" prefix key was pressed, with a short timeout to reset
  const gPressed = useRef(false);
  const gTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGState = useCallback(() => {
    gPressed.current = false;
    if (gTimeout.current) {
      clearTimeout(gTimeout.current);
      gTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      // Don't fire shortcuts when the user is typing
      if (isTypingTarget(e.target)) return;

      // "?" opens help (no modifier required)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onHelpOpen?.();
        clearGState();
        return;
      }

      // Handle the "g" chord prefix
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!gPressed.current) {
          // First "g" — arm the chord and start a reset timer
          gPressed.current = true;
          gTimeout.current = setTimeout(clearGState, 1500);
          return;
        }
        // Second "g" — fall through to the chord switch below (g+g → /goals)
      }

      // If "g" was previously pressed, check for the second chord key
      if (gPressed.current) {
        clearGState();
        switch (e.key) {
          case 'i':
            e.preventDefault();
            void navigate({ to: '/issues' });
            break;
          case 'a':
            e.preventDefault();
            void navigate({ to: '/activity' });
            break;
          case 'g':
            e.preventDefault();
            void navigate({ to: '/goals' });
            break;
          case 'p':
            e.preventDefault();
            void navigate({ to: '/prompts' });
            break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      clearGState();
    };
  }, [navigate, onHelpOpen, clearGState]);
}
