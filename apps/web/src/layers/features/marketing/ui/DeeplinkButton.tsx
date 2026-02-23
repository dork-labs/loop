'use client';

import { Download } from 'lucide-react';

/** Supported IDE deeplink targets. */
export type DeeplinkTarget = 'cursor' | 'vscode';

interface DeeplinkButtonProps {
  /** Display label for the button. */
  label: string;
  /** MCP server name used in the deeplink config. */
  serverName: string;
  /** MCP server URL (HTTP transport endpoint). */
  serverUrl: string;
  /** Target IDE for the deeplink. */
  target: DeeplinkTarget;
  /** Optional additional className. */
  className?: string;
}

/**
 * Build a Cursor one-click MCP install deeplink.
 *
 * @param serverName - MCP server name
 * @param serverUrl - MCP server HTTP endpoint
 */
function buildCursorDeeplink(serverName: string, serverUrl: string): string {
  const config = btoa(JSON.stringify({ url: serverUrl }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${config}`;
}

/**
 * Build a VS Code one-click MCP install deeplink.
 *
 * @param serverName - MCP server name
 * @param serverUrl - MCP server HTTP endpoint
 */
function buildVSCodeDeeplink(serverName: string, serverUrl: string): string {
  const config = JSON.stringify({ name: serverName, url: serverUrl });
  return `vscode:mcp/install?${encodeURIComponent(config)}`;
}

const DEEPLINK_BUILDERS: Record<DeeplinkTarget, (name: string, url: string) => string> = {
  cursor: buildCursorDeeplink,
  vscode: buildVSCodeDeeplink,
};

/**
 * One-click MCP server install button that opens a native IDE deeplink.
 *
 * Renders as an `<a>` tag (not a `<button>`) so the browser handles the
 * custom protocol URL and launches the target IDE. Styled as a prominent
 * CTA matching the Dorkian marketing brand.
 */
export function DeeplinkButton({
  label,
  serverName,
  serverUrl,
  target,
  className,
}: DeeplinkButtonProps) {
  const buildDeeplink = DEEPLINK_BUILDERS[target];
  const href = buildDeeplink(serverName, serverUrl);

  return (
    <a
      href={href}
      className={`marketing-btn inline-flex items-center gap-2 ${className ?? ''}`}
      style={{ background: '#E85D04', color: '#FFFEFB' }}
    >
      <Download size={14} aria-hidden="true" />
      {label}
    </a>
  );
}
