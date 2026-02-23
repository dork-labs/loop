import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { MarketingHeader, MarketingFooter, MarketingNav } from '@/layers/features/marketing';
import { AgentGrid } from '@/layers/features/marketing/ui/AgentGrid';
import { AgentSetupSections } from '@/layers/features/marketing/ui/AgentSetupSection';
import { CodeTabs } from '@/layers/features/marketing/ui/CodeTabs';
import { CopyCommand } from '@/layers/features/marketing/ui/CopyCommand';
import type { CodeTab } from '@/layers/features/marketing/ui/CodeTabs';

export const metadata: Metadata = {
  title: 'Integrations — Loop',
  description:
    'Connect Loop to every AI coding agent. One MCP server, zero configuration. Works with Cursor, VS Code, Claude Code, Windsurf, Codex CLI, OpenHands, Goose, and Gemini CLI.',
};

const navLinks = [
  { label: 'how it works', href: '/#how-it-works' },
  { label: 'features', href: '/#features' },
  { label: 'get started', href: '/#get-started' },
  { label: 'docs', href: '/docs' },
];

const socialLinks = [
  {
    name: 'GitHub',
    href: siteConfig.github,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
];

/** Code example content for the three-tab code examples section. */
const CODE_TABS: CodeTab[] = [
  {
    label: 'curl',
    language: 'bash',
    code: `# Get the next priority task for your agent
curl -X GET https://your-loop.com/api/dispatch/next \\
  -H "Authorization: Bearer tok_your_api_key"

# Create an issue from a signal
curl -X POST https://your-loop.com/api/issues \\
  -H "Authorization: Bearer tok_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Sign-up conversion dropped 12%",
    "type": "signal",
    "priority": "high"
  }'`,
  },
  {
    label: 'TypeScript SDK',
    language: 'typescript',
    code: `import { LoopClient } from '@dork-labs/loop-sdk';

const loop = new LoopClient({
  baseUrl: 'https://your-loop.com',
  apiKey: process.env.LOOP_API_KEY,
});

// Get the next task to work on
const task = await loop.dispatch.next();
console.log(task.instructions);

// Create a new issue
const issue = await loop.issues.create({
  title: 'Fix OAuth redirect latency',
  type: 'bug',
  priority: 'high',
});`,
  },
  {
    label: 'CLI',
    language: 'bash',
    code: `# Get next task
loop dispatch next

# Create an issue
loop issues create \\
  --title "Fix OAuth redirect latency" \\
  --type bug \\
  --priority high

# List open issues
loop issues list --status open`,
  },
];

/** The universal MCP add command shown in the hero. */
const ADD_MCP_COMMAND = 'npx add-mcp https://mcp.looped.me/mcp';

/** Integrations marketing page — showcases MCP server and per-agent setup instructions. */
export default function IntegrationsPage() {
  return (
    <>
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="bg-cream-primary px-8 pb-16 pt-40 text-center">
          <span className="text-2xs text-brand-orange mb-6 block font-mono tracking-[0.15em] uppercase">
            Integrations
          </span>
          <h1 className="text-charcoal mx-auto mb-6 max-w-2xl text-3xl font-medium tracking-[-0.02em] md:text-5xl">
            Works with every AI coding agent.
          </h1>
          <p className="text-warm-gray mx-auto mb-10 max-w-xl text-base leading-relaxed">
            Connect Loop to any MCP-compatible agent in seconds. One server, every tool — no
            configuration required.
          </p>
          <div className="flex justify-center">
            <CopyCommand command={ADD_MCP_COMMAND} />
          </div>
        </section>

        {/* Agent grid */}
        <section className="bg-cream-secondary px-8 py-20">
          <div className="mx-auto max-w-2xl">
            <AgentGrid />
          </div>
        </section>

        {/* Per-agent setup sections — alternating cream-primary / cream-secondary */}
        <AgentSetupSections />

        {/* Code examples */}
        <section className="bg-cream-tertiary px-8 py-24">
          <div className="mx-auto max-w-2xl">
            <span className="text-2xs text-brand-orange mb-6 block text-center font-mono tracking-[0.15em] uppercase">
              Code examples
            </span>
            <h2 className="text-charcoal mb-10 text-center text-2xl font-medium tracking-[-0.02em] md:text-3xl">
              Call the Loop API directly.
            </h2>
            <CodeTabs tabs={CODE_TABS} groupId="integrations-code-tabs" />
          </div>
        </section>
      </main>

      <MarketingFooter email={siteConfig.contactEmail} socialLinks={socialLinks} />

      <MarketingNav links={navLinks} />
    </>
  );
}
