import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetupCodeSnippet } from '@/components/setup-code-snippet';
import { env } from '@/env';

interface SetupChecklistProps {
  onComplete: () => void;
  issueCount: number;
  firstIssueId?: string;
}

/** FTUE setup checklist guiding users through their first API connection. */
export function SetupChecklist({ onComplete, issueCount, firstIssueId }: SetupChecklistProps) {
  const [copiedSteps, setCopiedSteps] = useState<Record<number, boolean>>({});
  const [showKey, setShowKey] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const celebrationFired = useRef(false);

  const apiUrl = env.VITE_API_URL;
  const apiKey = env.VITE_LOOP_API_KEY;

  const maskedKey = `${apiKey.slice(0, 5)}${'•'.repeat(Math.max(apiKey.length - 5, 8))}`;

  const handleCopy = useCallback(async (step: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSteps((prev) => ({ ...prev, [step]: true }));
    setTimeout(() => setCopiedSteps((prev) => ({ ...prev, [step]: false })), 2000);
  }, []);

  // Celebration trigger when first issue arrives
  useEffect(() => {
    if (issueCount === 0 || celebrationFired.current) return;
    celebrationFired.current = true;

    const fireCelebration = async () => {
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setShowSuccess(true);
      onComplete();
    };

    if (document.visibilityState === 'visible') {
      void fireCelebration();
    } else {
      const handler = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', handler);
          void fireCelebration();
        }
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }
  }, [issueCount, onComplete]);

  if (showSuccess) {
    return (
      <div className="border-border bg-card flex flex-col items-center justify-center gap-4 rounded-lg border py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
          <Check className="size-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">Loop is connected!</h2>
        <p className="text-muted-foreground">
          Your first issue just arrived. The loop is ready to run.
        </p>
        {firstIssueId && (
          <Button asChild className="mt-2">
            <Link to="/issues/$issueId" params={{ issueId: firstIssueId }}>
              View Issue
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Connect your AI agent</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Follow these steps to send your first issue to Loop
        </p>
      </div>
      <div className="space-y-6">
        {/* Step 1: API Endpoint */}
        <SetupStep number={1} title="API Endpoint" completed={copiedSteps[1] ?? false}>
          <div className="flex items-center gap-2">
            <code className="bg-muted rounded px-2 py-1 text-sm">{apiUrl}</code>
            <Button variant="ghost" size="sm" onClick={() => void handleCopy(1, apiUrl)}>
              {copiedSteps[1] ? (
                <>
                  <Check className="mr-1 size-3.5 text-green-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1 size-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
        </SetupStep>

        {/* Step 2: API Key */}
        <SetupStep number={2} title="API Key" completed={copiedSteps[2] ?? false}>
          <div className="flex items-center gap-2">
            <code className="bg-muted rounded px-2 py-1 font-mono text-sm">
              {showKey ? apiKey : maskedKey}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setShowKey((prev) => !prev)}
            >
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleCopy(2, apiKey)}>
              {copiedSteps[2] ? (
                <>
                  <Check className="mr-1 size-3.5 text-green-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1 size-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
        </SetupStep>

        {/* Step 3: Code Snippet */}
        <SetupStep number={3} title="Send your first issue" completed={copiedSteps[3] ?? false}>
          <SetupCodeSnippet
            apiUrl={apiUrl}
            apiKey={apiKey}
            onCopy={() => setCopiedSteps((prev) => ({ ...prev, [3]: true }))}
          />
        </SetupStep>

        {/* Step 4: Listening */}
        <SetupStep number={4} title="Listening for your first issue..." completed={false}>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            <span>Polling every 3 seconds...</span>
          </div>
        </SetupStep>
      </div>
    </div>
  );
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

interface SetupStepProps {
  number: number;
  title: string;
  completed: boolean;
  children: React.ReactNode;
}

function SetupStep({ number, title, completed, children }: SetupStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex size-7 items-center justify-center rounded-full border text-xs font-medium ${
            completed
              ? 'border-green-500 bg-green-500/10 text-green-500'
              : 'border-border text-muted-foreground'
          }`}
        >
          {completed ? <Check className="size-3.5" /> : number}
        </div>
      </div>
      <div className="flex-1 space-y-2 pb-2">
        <p className={`text-sm font-medium ${completed ? 'text-muted-foreground' : ''}`}>{title}</p>
        {children}
      </div>
    </div>
  );
}
