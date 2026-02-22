import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WelcomeModal } from '@/components/welcome-modal';

describe('WelcomeModal', () => {
  it('renders dialog content when open', () => {
    render(<WelcomeModal open={true} onClose={vi.fn()} />);

    expect(screen.getByText('Welcome to Loop')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(<WelcomeModal open={false} onClose={vi.fn()} />);

    expect(screen.queryByText('Welcome to Loop')).not.toBeInTheDocument();
    expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
  });

  it('calls onClose when Get Started button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<WelcomeModal open={true} onClose={onClose} />);

    await user.click(screen.getByText('Get Started'));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
