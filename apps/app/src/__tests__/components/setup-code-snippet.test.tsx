import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupCodeSnippet } from '@/components/setup-code-snippet';

const TEST_API_URL = 'https://api.example.com';
const TEST_API_KEY = 'test-key-abc123';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeTextMock.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});

describe('SetupCodeSnippet', () => {
  it('renders all three language tabs', () => {
    render(<SetupCodeSnippet apiUrl={TEST_API_URL} apiKey={TEST_API_KEY} />);

    expect(screen.getByRole('tab', { name: 'curl' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'JavaScript' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Python' })).toBeInTheDocument();
  });

  it('injects apiUrl and apiKey into the displayed snippet', () => {
    render(<SetupCodeSnippet apiUrl={TEST_API_URL} apiKey={TEST_API_KEY} />);

    // The default curl tab should be visible with injected credentials
    const curlPanel = screen.getByRole('tabpanel');
    expect(curlPanel).toHaveTextContent(TEST_API_URL);
    expect(curlPanel).toHaveTextContent(TEST_API_KEY);
  });

  it('copies the snippet to clipboard and calls onCopy', async () => {
    const onCopy = vi.fn();

    render(<SetupCodeSnippet apiUrl={TEST_API_URL} apiKey={TEST_API_KEY} onCopy={onCopy} />);

    // Click the copy button in the active curl tab panel using fireEvent
    // to avoid userEvent clipboard interception
    const panel = screen.getByRole('tabpanel');
    const copyButton = within(panel).getByRole('button');
    copyButton.click();

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledOnce();
    });
    const copiedText = writeTextMock.mock.calls[0][0] as string;
    expect(copiedText).toContain(TEST_API_URL);
    expect(copiedText).toContain(TEST_API_KEY);
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('switches tabs and shows the correct language snippet', async () => {
    const user = userEvent.setup();

    render(<SetupCodeSnippet apiUrl={TEST_API_URL} apiKey={TEST_API_KEY} />);

    // Default tab is curl — verify curl content is visible
    expect(screen.getByRole('tabpanel')).toHaveTextContent('curl -X POST');

    // Switch to JavaScript tab
    await user.click(screen.getByRole('tab', { name: 'JavaScript' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('await fetch');

    // Switch to Python tab
    await user.click(screen.getByRole('tab', { name: 'Python' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('import requests');
  });
});
