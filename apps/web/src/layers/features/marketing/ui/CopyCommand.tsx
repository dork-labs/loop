'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

/** Duration in ms before copy icon resets back to clipboard. */
const COPY_RESET_DELAY = 2000;

interface CopyCommandProps {
  /** The command text to display and copy. */
  command: string;
}

/**
 * Inline terminal-style command display with copy-to-clipboard button.
 *
 * Shows the command in a dark code block with a $ prompt prefix and
 * a copy button that provides Check feedback for 2 seconds.
 */
export function CopyCommand({ command }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_DELAY);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [command]);

  return (
    <div className="bg-charcoal inline-flex items-center gap-4 rounded-lg px-6 py-4">
      <span className="text-warm-gray-light shrink-0 font-mono text-sm select-none" aria-hidden="true">
        $
      </span>
      <code className="text-cream-primary font-mono text-sm">{command}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        className="text-warm-gray-light hover:text-cream-primary ml-2 shrink-0 transition-colors"
      >
        {copied ? (
          <Check size={16} aria-hidden="true" className="text-brand-green" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
