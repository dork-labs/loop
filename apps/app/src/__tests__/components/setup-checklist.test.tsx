import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupChecklist } from '@/components/setup-checklist';

vi.mock('@/env', () => ({
  env: {
    VITE_API_URL: 'http://localhost:5667',
    VITE_LOOP_API_KEY: 'sk-test-key-123',
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a href={String(props.to ?? '#')}>{children}</a>
  ),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SetupChecklist', () => {
  it('renders all 4 steps', () => {
    render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource={null} />);

    expect(screen.getByText('API Endpoint')).toBeInTheDocument();
    expect(screen.getByText('API Key')).toBeInTheDocument();
    expect(screen.getByText('Connect your agent')).toBeInTheDocument();
    expect(screen.getByText('Waiting for your agent to send its first issue...')).toBeInTheDocument();
  });

  it('shows the default waiting subtext in step 4 when agentSource is null', () => {
    render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource={null} />);

    expect(
      screen.getByText('Send a signal via the API or run npx @dork-labs/loop-connect to configure your agent.'),
    ).toBeInTheDocument();
  });

  it('calls onComplete and shows success when issueCount > 0', async () => {
    const onComplete = vi.fn();

    render(
      <SetupChecklist
        onComplete={onComplete}
        issueCount={1}
        firstIssueId="issue-1"
        agentSource={null}
      />,
    );

    // The celebration fires asynchronously (dynamic import of canvas-confetti)
    await waitFor(() => {
      expect(screen.getByText('Your agent is connected to Loop.')).toBeInTheDocument();
    });
    expect(screen.getByText('View Issue')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('displays the API URL from env', () => {
    render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource={null} />);

    expect(screen.getByText('http://localhost:5667')).toBeInTheDocument();
  });

  it('masks the API key by default in step 2', () => {
    render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource={null} />);

    // The masked key should contain bullet characters
    const maskedKey = screen.getByText(/sk-.*\u2022/);
    expect(maskedKey).toBeInTheDocument();
  });
});
