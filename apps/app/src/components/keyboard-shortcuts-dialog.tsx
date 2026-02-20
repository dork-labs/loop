import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

interface ShortcutRowProps {
  keys: string[]
  label: string
}

function ShortcutRow({ keys, label }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-xs text-muted-foreground">then</span>}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
              {key}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  )
}

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Sheet overlay listing all available keyboard shortcuts in the dashboard.
 */
export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Keyboard Shortcuts</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </p>
            <ShortcutRow keys={['g', 'i']} label="Go to Issues" />
            <ShortcutRow keys={['g', 'a']} label="Go to Activity" />
            <ShortcutRow keys={['g', 'g']} label="Go to Goals" />
            <ShortcutRow keys={['g', 'p']} label="Go to Prompts" />
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Layout
            </p>
            <ShortcutRow keys={['⌘', 'B']} label="Toggle sidebar" />
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              General
            </p>
            <ShortcutRow keys={['?']} label="Show this help" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
