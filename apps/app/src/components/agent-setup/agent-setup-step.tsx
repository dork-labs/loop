import { useState, useCallback } from 'react';
import { ChevronDown, Terminal, Zap, Monitor, Check, Copy } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Button } from '@/components/ui/button';
import type { AgentSource } from '@/hooks/use-agent-detection';
import { AgentPathCard } from './agent-path-card';
import { CursorDeeplinkButton } from './cursor-deeplink-button';
import { SetupCodeSnippet } from '@/components/setup-code-snippet';

interface AgentSetupStepProps {
  agentSource: AgentSource | null;
  apiUrl: string;
  apiKey: string;
  onCopy?: () => void;
}

interface CopyCommandProps {
  command: string;
  copied: boolean;
  onCopy: (text: string) => void;
}

function CopyCommand({ command, copied, onCopy }: CopyCommandProps) {
  return (
    <div className="flex items-center gap-2">
      <code className="bg-muted flex-1 rounded px-3 py-2 font-mono text-xs">{command}</code>
      <Button variant="ghost" size="sm" onClick={() => onCopy(command)}>
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

function LoopConnectConfirmation() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-green-800 bg-green-950/30 p-4">
      <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
      <p className="text-sm text-green-300">
        Your agent is configured. Ask it to create an issue to verify the connection.
      </p>
    </div>
  );
}

interface AlternativesContext {
  agentSource: AgentSource | null;
  apiUrl: string;
  apiKey: string;
  claudeCommand: string;
  connectCommand: string;
  copied: boolean;
  onCopy: (text: string) => void;
  onSnippetCopy?: () => void;
}

function ConnectCliCard({ connectCommand, copied, onCopy }: Pick<AlternativesContext, 'connectCommand' | 'copied' | 'onCopy'>) {
  return (
    <AgentPathCard
      icon={<Terminal className="size-4" />}
      title="Loop Connect CLI"
      description="Automatic setup via the connect wizard"
    >
      <CopyCommand command={connectCommand} copied={copied} onCopy={onCopy} />
    </AgentPathCard>
  );
}

function CursorCard({ apiUrl, apiKey }: Pick<AlternativesContext, 'apiUrl' | 'apiKey'>) {
  return (
    <AgentPathCard
      icon={<Monitor className="size-4" />}
      title="Cursor"
      description="One-click MCP install via deeplink"
    >
      <CursorDeeplinkButton apiUrl={apiUrl} apiKey={apiKey} />
    </AgentPathCard>
  );
}

function ClaudeCodeCard({ claudeCommand, copied, onCopy }: Pick<AlternativesContext, 'claudeCommand' | 'copied' | 'onCopy'>) {
  return (
    <AgentPathCard
      icon={<Zap className="size-4" />}
      title="Claude Code"
      description="Add Loop as an MCP server via the CLI"
    >
      <CopyCommand command={claudeCommand} copied={copied} onCopy={onCopy} />
    </AgentPathCard>
  );
}

function ManualCard({ apiUrl, apiKey, onSnippetCopy }: Pick<AlternativesContext, 'apiUrl' | 'apiKey' | 'onSnippetCopy'>) {
  return (
    <AgentPathCard
      icon={<Terminal className="size-4" />}
      title="Manual"
      description="Use the API directly with curl, JS, or Python"
    >
      <SetupCodeSnippet apiUrl={apiUrl} apiKey={apiKey} onCopy={onSnippetCopy} />
    </AgentPathCard>
  );
}

function renderPrimary(ctx: AlternativesContext) {
  switch (ctx.agentSource) {
    case 'loop-connect':
      return <LoopConnectConfirmation />;
    case 'cursor':
      return <CursorDeeplinkButton apiUrl={ctx.apiUrl} apiKey={ctx.apiKey} />;
    case 'claude-code':
      return (
        <CopyCommand command={ctx.claudeCommand} copied={ctx.copied} onCopy={ctx.onCopy} />
      );
    default:
      return (
        <CopyCommand command={ctx.connectCommand} copied={ctx.copied} onCopy={ctx.onCopy} />
      );
  }
}

// Primary sources that use connect CLI — excluded from alternatives when primary
const CONNECT_CLI_PRIMARY_SOURCES = new Set<AgentSource | null>([null, 'openhands', 'loop-connect']);

function renderAlternatives(ctx: AlternativesContext) {
  const { agentSource } = ctx;
  const cards = [];

  // Show connect CLI when it is not the primary CTA
  if (!CONNECT_CLI_PRIMARY_SOURCES.has(agentSource)) {
    cards.push(
      <ConnectCliCard
        key="connect"
        connectCommand={ctx.connectCommand}
        copied={ctx.copied}
        onCopy={ctx.onCopy}
      />
    );
  }

  // Show Cursor card when not already primary
  if (agentSource !== 'cursor') {
    cards.push(
      <CursorCard key="cursor" apiUrl={ctx.apiUrl} apiKey={ctx.apiKey} />
    );
  }

  // Show Claude Code card when not already primary
  if (agentSource !== 'claude-code') {
    cards.push(
      <ClaudeCodeCard
        key="claude-code"
        claudeCommand={ctx.claudeCommand}
        copied={ctx.copied}
        onCopy={ctx.onCopy}
      />
    );
  }

  // Always add manual as last option
  cards.push(
    <ManualCard
      key="manual"
      apiUrl={ctx.apiUrl}
      apiKey={ctx.apiKey}
      onSnippetCopy={ctx.onSnippetCopy}
    />
  );

  return cards;
}

/**
 * Agent setup step with auto-detected primary CTA and collapsible alternatives.
 *
 * Renders a context-aware primary connection method based on the detected agent
 * source, with a collapsible section showing all other integration paths.
 */
export function AgentSetupStep({ agentSource, apiUrl, apiKey, onCopy }: AgentSetupStepProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    },
    [onCopy]
  );

  const claudeCommand = `claude mcp add loop --transport stdio -- npx -y @dork-labs/loop-mcp --api-url ${apiUrl} --api-key ${apiKey}`;
  const connectCommand = 'npx @dork-labs/loop-connect';

  const ctx: AlternativesContext = {
    agentSource,
    apiUrl,
    apiKey,
    claudeCommand,
    connectCommand,
    copied,
    onCopy: (text) => void handleCopy(text),
    onSnippetCopy: onCopy,
  };

  return (
    <div className="space-y-4">
      {renderPrimary(ctx)}

      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
          <ChevronDown
            className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          Other ways to connect
        </Collapsible.Trigger>
        <Collapsible.Content className="mt-3 space-y-3">
          {renderAlternatives(ctx)}
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
