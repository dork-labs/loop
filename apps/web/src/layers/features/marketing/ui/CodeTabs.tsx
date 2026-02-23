'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Copy } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** A single tab definition for CodeTabs. */
export interface CodeTab {
  label: string;
  language: string;
  code: string;
}

export interface CodeTabsProps {
  tabs: CodeTab[];
  /** When provided, active tab index is persisted to localStorage under this key. */
  groupId?: string;
}

const COPY_FEEDBACK_MS = 2000;

function readStoredIndex(groupId: string | undefined, tabCount: number): number {
  if (!groupId || typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(groupId);
    const parsed = stored !== null ? parseInt(stored, 10) : NaN;
    return !isNaN(parsed) && parsed >= 0 && parsed < tabCount ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeStoredIndex(groupId: string | undefined, index: number): void {
  if (!groupId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(groupId, String(index));
  } catch {
    // localStorage may be unavailable in restricted contexts
  }
}

/**
 * Tabbed code snippet component with Shiki syntax highlighting and
 * localStorage-backed tab persistence.
 *
 * Renders a dark code block matching the charcoal styling of QuickStartSection,
 * with a copy-to-clipboard button that shows brief success feedback.
 */
export function CodeTabs({ tabs, groupId }: CodeTabsProps) {
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    readStoredIndex(groupId, tabs.length)
  );
  const [highlightedHtml, setHighlightedHtml] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Highlight the active tab's code with Shiki
  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      const activeTab = tabs[activeIndex];
      if (!activeTab) return;

      try {
        const { codeToHtml } = await import('shiki/bundle/web');
        const html = await codeToHtml(activeTab.code, {
          lang: activeTab.language,
          theme: 'github-dark',
        });
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch {
        // Fallback to plain text if Shiki fails
        if (!cancelled) {
          setHighlightedHtml('');
        }
      }
    }

    highlight();

    return () => {
      cancelled = true;
    };
  }, [activeIndex, tabs]);

  const handleTabChange = useCallback(
    (index: number) => {
      setActiveIndex(index);
      writeStoredIndex(groupId, index);
    },
    [groupId]
  );

  const handleCopy = useCallback(async () => {
    const code = tabs[activeIndex]?.code;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, COPY_FEEDBACK_MS);
    } catch {
      // Clipboard API may not be available
    }
  }, [activeIndex, tabs]);

  // Clean up copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (tabs.length === 0) return null;

  // Base UI Tabs uses value prop for controlled state; map index to string value
  const activeValue = String(activeIndex);

  return (
    <div className="overflow-hidden rounded-lg">
      <Tabs
        value={activeValue}
        onValueChange={(value) => handleTabChange(Number(value))}
        className="gap-0"
      >
        {/* Tab list header */}
        <div className="bg-charcoal/80 flex items-center justify-between px-2 pt-1">
          <TabsList className="h-auto rounded-none bg-transparent p-0">
            {tabs.map((tab, index) => (
              <TabsTrigger
                key={tab.label}
                value={String(index)}
                className={cn(
                  'rounded-none border-0 border-b-2 bg-transparent px-4 py-2.5 font-mono text-xs tracking-[0.1em] uppercase shadow-none',
                  'text-warm-gray-light transition-colors',
                  'data-active:border-brand-orange data-active:text-cream-primary data-active:bg-transparent',
                  'data-[state=inactive]:border-transparent'
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            aria-label={isCopied ? 'Copied!' : 'Copy code'}
            className="text-warm-gray-light hover:text-cream-primary mr-2 cursor-pointer rounded p-1.5 transition-colors"
          >
            {isCopied ? (
              <Check className="size-4 text-brand-green" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Code panels */}
        {tabs.map((tab, index) => (
          <TabsContent key={tab.label} value={String(index)}>
            <div className="bg-[#1a1814] min-h-[200px] overflow-x-auto p-6">
              {highlightedHtml && activeIndex === index ? (
                <div
                  className="shiki-container font-mono text-sm [&_pre]:!bg-transparent [&_pre]:p-0 [&_code]:font-mono [&_code]:text-sm"
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              ) : (
                <pre className="text-cream-primary m-0 font-mono text-sm whitespace-pre">
                  <code>{tab.code}</code>
                </pre>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
