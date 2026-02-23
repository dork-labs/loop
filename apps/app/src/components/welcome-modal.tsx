import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

/** One-time welcome dialog shown on first visit to the dashboard. */
export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-4 text-center">
          <div className="bg-primary/10 mx-auto flex size-16 items-center justify-center rounded-full">
            <svg
              className="text-primary size-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <DialogTitle className="text-2xl font-bold">Welcome to Loop</DialogTitle>
          <DialogDescription className="text-muted-foreground text-base leading-relaxed">
            Loop collects signals, organizes work into issues, and tells your AI agent what to do
            next.
            <br />
            <br />
            Let&apos;s get you connected.
          </DialogDescription>
        </DialogHeader>
        <Button className="mt-4 w-full" onClick={onClose}>
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  );
}
