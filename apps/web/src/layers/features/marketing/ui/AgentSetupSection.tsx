'use client';

import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Copy, Check } from 'lucide-react';
import { REVEAL, VIEWPORT } from '../lib/motion-variants';
import { DeeplinkButton } from './DeeplinkButton';
import { AGENTS, MCP_SERVER_CONFIG, type AgentPlatform, type AgentSetup } from '../lib/agents';

/** Duration in ms before copy icon resets back to clipboard. */
const COPY_RESET_DELAY = 2000;

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

interface CopyButtonProps {
  /** The text that will be copied to clipboard when the button is clicked. */
  text: string;
}

/** Inline icon button that copies text to clipboard with Check feedback. */
function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_DELAY);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className="text-warm-gray-light hover:text-cream-primary shrink-0 transition-colors"
    >
      {copied ? (
        <Check size={16} aria-hidden="true" className="text-brand-green" />
      ) : (
        <Copy size={16} aria-hidden="true" />
      )}
    </button>
  );
}

interface CodeBlockProps {
  /** Optional filename header shown above the code. */
  filename?: string;
  /** The code content to display and allow copying. */
  content: string;
}

/** Dark code block with optional filename header and copy button. */
function CodeBlock({ filename, content }: CodeBlockProps) {
  return (
    <div className="bg-charcoal overflow-hidden rounded-lg">
      {filename && (
        <div className="border-warm-gray-light/20 flex items-center justify-between border-b px-6 py-3">
          <span className="text-warm-gray-light font-mono text-xs">{filename}</span>
          <CopyButton text={content} />
        </div>
      )}
      <div className="overflow-x-auto p-6">
        {!filename && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-warm-gray-light font-mono text-xs select-none">$</span>
            <CopyButton text={content} />
          </div>
        )}
        <pre className="text-cream-primary m-0 font-mono text-sm leading-relaxed">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}

interface ManualConfigFallbackProps {
  /** The JSON config string to display in the fallback block. */
  config: string;
}

/** "Or configure manually" fallback shown below all primary setup CTAs. */
function ManualConfigFallback({ config }: ManualConfigFallbackProps) {
  return (
    <div className="mt-6">
      <p className="text-warm-gray mb-3 text-sm">Or configure manually:</p>
      <CodeBlock filename=".mcp.json" content={config} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup type renderers
// ---------------------------------------------------------------------------

const MANUAL_CONFIG_JSON = JSON.stringify(
  { mcpServers: { [MCP_SERVER_CONFIG.name]: { url: MCP_SERVER_CONFIG.url } } },
  null,
  2,
);

/** Render the primary CTA area based on the agent's setup discriminated union. */
function SetupContent({ setup, agentName }: { setup: AgentSetup; agentName: string }) {
  if (setup.type === 'deeplink') {
    return (
      <div>
        <DeeplinkButton
          label={`Add to ${agentName}`}
          serverName={MCP_SERVER_CONFIG.name}
          serverUrl={MCP_SERVER_CONFIG.url}
          target={setup.protocol}
        />
        <ManualConfigFallback config={MANUAL_CONFIG_JSON} />
      </div>
    );
  }

  if (setup.type === 'cli') {
    return (
      <div>
        <CodeBlock content={setup.command} />
        <ManualConfigFallback config={MANUAL_CONFIG_JSON} />
      </div>
    );
  }

  // setup.type === 'config'
  return <CodeBlock filename={setup.filename} content={setup.content} />;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface AgentSetupSectionProps {
  /** The agent platform to render setup instructions for. */
  agent: AgentPlatform;
}

/**
 * Renders all agent setup sections with alternating backgrounds.
 *
 * This wrapper exists so the AGENTS array (which contains function components
 * as Logo fields) stays within the client boundary — server components cannot
 * pass functions as props to client components.
 */
export function AgentSetupSections() {
  return (
    <>
      {AGENTS.map((agent, index) => (
        <div
          key={agent.id}
          className={index % 2 === 0 ? 'bg-cream-primary' : 'bg-cream-secondary'}
        >
          <AgentSetupSection agent={agent} />
        </div>
      ))}
    </>
  );
}

/**
 * Full-bleed section with setup instructions for a single agent platform.
 *
 * Renders a scroll-anchored section with the agent logo, name, and primary
 * setup CTA (deeplink button, CLI code block, or config code block). All
 * agents also receive a manual JSON config fallback. Entrance animation
 * uses REVEAL + VIEWPORT for scroll-triggered fade-in.
 *
 * @param agent - The agent platform definition from `AGENTS`
 */
export function AgentSetupSection({ agent }: AgentSetupSectionProps) {
  const { Logo, name, setup, anchor } = agent;

  return (
    <section id={anchor} className="scroll-mt-24 px-8 py-16">
      <motion.div
        className="mx-auto max-w-2xl"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={REVEAL}
      >
        {/* Agent identity */}
        <div className="mb-8 flex items-center gap-4">
          <Logo className="shrink-0" />
          <h2 className="text-charcoal text-2xl font-medium tracking-[-0.02em]">{name}</h2>
        </div>

        {/* Setup instructions */}
        <SetupContent setup={setup} agentName={name} />
      </motion.div>
    </section>
  );
}
