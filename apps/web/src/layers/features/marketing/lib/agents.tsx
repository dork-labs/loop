import type { FC } from 'react';

/**
 * Supported agent setup methods — discriminated union on `type`.
 *
 * - `deeplink`: One-click install via protocol URL (Cursor, VS Code)
 * - `cli`: Single CLI command to run
 * - `config`: JSON config file to create/edit
 */
export type AgentSetup =
  | { type: 'deeplink'; protocol: 'cursor' | 'vscode'; config: Record<string, unknown> }
  | { type: 'cli'; command: string }
  | { type: 'config'; filename: string; content: string };

/**
 * Agent platform definition for marketing site display and setup instructions.
 */
export interface AgentPlatform {
  id: string;
  name: string;
  /** SVG component rendered inline — monochrome warm-gray, 40x40. */
  Logo: FC<{ className?: string }>;
  /** Setup method for this agent. */
  setup: AgentSetup;
  /** Anchor id for scroll-to on the integrations page. */
  anchor: string;
}

/** Loop MCP server connection config used across all agent setup methods. */
export const MCP_SERVER_CONFIG = {
  name: 'loop',
  url: 'https://mcp.looped.me/mcp',
} as const;

// ---------------------------------------------------------------------------
// MCP config JSON shared by config-type agents
// ---------------------------------------------------------------------------

const MCP_CONFIG_JSON = JSON.stringify(
  { mcpServers: { [MCP_SERVER_CONFIG.name]: { url: MCP_SERVER_CONFIG.url } } },
  null,
  2,
);

// ---------------------------------------------------------------------------
// Agent Logo components — monochrome warm-gray inline SVGs
// ---------------------------------------------------------------------------

/** Cursor arrow logomark — monochrome warm-gray. */
function CursorLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cursor"
      role="img"
      className={className}
    >
      {/* Cursor arrow pointer */}
      <path d="M10 6L10 32L17 25L24 34L28 32L21 23L30 21L10 6Z" fill="#7A756A" />
    </svg>
  );
}

/** VS Code bracket logomark — monochrome warm-gray. */
function VSCodeLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="VS Code"
      role="img"
      className={className}
    >
      {/* Simplified VS Code bracket shape */}
      <path
        d="M28 6L14 20L28 34L31 31L20 20L31 9L28 6Z"
        fill="#7A756A"
      />
      <rect x="30" y="6" width="3" height="28" rx="1" fill="#7A756A" />
    </svg>
  );
}

/** Claude Code terminal prompt logomark — monochrome warm-gray. */
function ClaudeCodeLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Claude Code"
      role="img"
      className={className}
    >
      {/* Terminal window */}
      <rect x="4" y="8" width="32" height="24" rx="3" fill="#7A756A" />
      {/* Prompt chevron */}
      <path d="M10 18L16 22L10 26" stroke="#F5F0E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Cursor line */}
      <line x1="19" y1="26" x2="28" y2="26" stroke="#F5F0E8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Windsurf wave logomark — monochrome warm-gray. */
function WindsurfLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Windsurf"
      role="img"
      className={className}
    >
      {/* Sail */}
      <path d="M20 4L20 32L8 28Z" fill="#7A756A" />
      {/* Wave */}
      <path
        d="M4 34C8 30 12 30 16 34C20 38 24 38 28 34C32 30 36 30 40 34"
        stroke="#7A756A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Codex CLI command-line logomark — monochrome warm-gray. */
function CodexCLILogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Codex CLI"
      role="img"
      className={className}
    >
      {/* Terminal box */}
      <rect x="4" y="8" width="32" height="24" rx="3" stroke="#7A756A" strokeWidth="2.5" />
      {/* Dollar prompt */}
      <text x="10" y="24" fill="#7A756A" fontSize="14" fontFamily="monospace" fontWeight="bold">
        $
      </text>
      {/* Blinking cursor */}
      <rect x="20" y="16" width="2" height="12" rx="1" fill="#7A756A" />
    </svg>
  );
}

/** OpenHands robot hand logomark — monochrome warm-gray. */
function OpenHandsLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="OpenHands"
      role="img"
      className={className}
    >
      {/* Palm */}
      <rect x="11" y="18" width="18" height="16" rx="4" fill="#7A756A" />
      {/* Fingers */}
      <rect x="12" y="6" width="4" height="14" rx="2" fill="#7A756A" />
      <rect x="18" y="4" width="4" height="16" rx="2" fill="#7A756A" />
      <rect x="24" y="6" width="4" height="14" rx="2" fill="#7A756A" />
      {/* Thumb */}
      <rect x="6" y="16" width="4" height="10" rx="2" fill="#7A756A" transform="rotate(-15 6 16)" />
    </svg>
  );
}

/** Goose bird silhouette logomark — monochrome warm-gray. */
function GooseLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Goose"
      role="img"
      className={className}
    >
      {/* Body */}
      <ellipse cx="22" cy="28" rx="10" ry="7" fill="#7A756A" />
      {/* Neck */}
      <path d="M14 26C12 22 10 16 12 10C13 7 16 6 18 8" stroke="#7A756A" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Head */}
      <circle cx="18" cy="8" r="4" fill="#7A756A" />
      {/* Beak */}
      <path d="M21 7L26 8L21 10" fill="#5C5750" />
      {/* Eye */}
      <circle cx="17" cy="7" r="1" fill="#F5F0E8" />
    </svg>
  );
}

/** Gemini CLI sparkle/star logomark — monochrome warm-gray. */
function GeminiCLILogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Gemini CLI"
      role="img"
      className={className}
    >
      {/* Four-point star / sparkle */}
      <path
        d="M20 4C20 4 22 16 28 20C22 24 20 36 20 36C20 36 18 24 12 20C18 16 20 4 20 4Z"
        fill="#7A756A"
      />
      {/* Small accent sparkle */}
      <path
        d="M32 8C32 8 33 12 35 14C33 16 32 20 32 20C32 20 31 16 29 14C31 12 32 8 32 8Z"
        fill="#7A756A"
        opacity="0.6"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

/** All supported agent platforms with setup configuration and logos. */
export const AGENTS: AgentPlatform[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    Logo: CursorLogo,
    setup: {
      type: 'deeplink',
      protocol: 'cursor',
      config: { url: MCP_SERVER_CONFIG.url },
    },
    anchor: 'cursor',
  },
  {
    id: 'vscode',
    name: 'VS Code',
    Logo: VSCodeLogo,
    setup: {
      type: 'deeplink',
      protocol: 'vscode',
      config: { name: MCP_SERVER_CONFIG.name, url: MCP_SERVER_CONFIG.url },
    },
    anchor: 'vscode',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    Logo: ClaudeCodeLogo,
    setup: {
      type: 'cli',
      command: `claude mcp add --transport http ${MCP_SERVER_CONFIG.name} ${MCP_SERVER_CONFIG.url}`,
    },
    anchor: 'claude-code',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    Logo: WindsurfLogo,
    setup: { type: 'config', filename: '.mcp.json', content: MCP_CONFIG_JSON },
    anchor: 'windsurf',
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    Logo: CodexCLILogo,
    setup: { type: 'config', filename: '.mcp.json', content: MCP_CONFIG_JSON },
    anchor: 'codex-cli',
  },
  {
    id: 'openhands',
    name: 'OpenHands',
    Logo: OpenHandsLogo,
    setup: { type: 'config', filename: '.mcp.json', content: MCP_CONFIG_JSON },
    anchor: 'openhands',
  },
  {
    id: 'goose',
    name: 'Goose',
    Logo: GooseLogo,
    setup: { type: 'config', filename: '.mcp.json', content: MCP_CONFIG_JSON },
    anchor: 'goose',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    Logo: GeminiCLILogo,
    setup: { type: 'config', filename: '.mcp.json', content: MCP_CONFIG_JSON },
    anchor: 'gemini-cli',
  },
];
