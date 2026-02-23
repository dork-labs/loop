// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentSetupStep } from '@/components/agent-setup/agent-setup-step';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeTextMock.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});

describe('AgentSetupStep', () => {
  const defaultProps = {
    apiUrl: 'http://localhost:5667',
    apiKey: 'loop_test123',
  };

  it('shows loop-connect confirmation when agentSource is loop-connect', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="loop-connect" />);
    expect(screen.getByText(/your agent is configured/i)).toBeInTheDocument();
  });

  it('shows Cursor deeplink button when agentSource is cursor', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);
    expect(screen.getByText(/add to cursor/i)).toBeInTheDocument();
  });

  it('shows Claude Code command when agentSource is claude-code', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="claude-code" />);
    expect(screen.getByText(/claude mcp add/i)).toBeInTheDocument();
  });

  it('shows default connect command when agentSource is null', () => {
    render(<AgentSetupStep {...defaultProps} agentSource={null} />);
    expect(screen.getByText(/npx @dork-labs\/loop-connect/i)).toBeInTheDocument();
  });

  it('renders "Other ways to connect" collapsible', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);
    expect(screen.getByText(/other ways to connect/i)).toBeInTheDocument();
  });

  it('collapsible starts closed and opens on click to reveal alternatives', async () => {
    const user = userEvent.setup();
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);

    const trigger = screen.getByText(/other ways to connect/i);

    // Before opening, alternative cards should not be visible
    expect(screen.queryByText('Loop Connect CLI')).not.toBeInTheDocument();

    // Click to open
    await user.click(trigger);

    // After opening, alternative paths should be visible
    expect(screen.getByText('Loop Connect CLI')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('excludes the primary source from alternatives when agentSource is cursor', async () => {
    const user = userEvent.setup();
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);

    await user.click(screen.getByText(/other ways to connect/i));

    // Cursor is the primary, so "Cursor" card should not appear in alternatives
    // The primary "Add to Cursor" button exists, but no "Cursor" card title in alternatives
    const cursorHeadings = screen.queryAllByText('Cursor');
    expect(cursorHeadings).toHaveLength(0);
  });

  it('excludes connect CLI from alternatives when agentSource is null', async () => {
    const user = userEvent.setup();
    render(<AgentSetupStep {...defaultProps} agentSource={null} />);

    await user.click(screen.getByText(/other ways to connect/i));

    // Connect CLI is the primary when agentSource is null, so it should not appear in alternatives
    expect(screen.queryByText('Loop Connect CLI')).not.toBeInTheDocument();

    // But Cursor and Claude Code should appear
    expect(screen.getByText('Cursor')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });
});
