import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ErrorBoundary } from '@/components/error-boundary'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

export const Route = createFileRoute('/_dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  )
}

/**
 * Inner content component. Must be a child of SidebarProvider so it can
 * consume the sidebar context for the Cmd+B toggle shortcut.
 */
function DashboardContent() {
  const { toggleSidebar } = useSidebar()
  const [helpOpen, setHelpOpen] = useState(false)

  // Navigation shortcuts: g+i, g+a, g+g, g+p — plus "?" for help
  useKeyboardShortcuts({ onHelpOpen: () => setHelpOpen(true) })

  // Cmd+B (Mac) / Ctrl+B (Windows/Linux) toggles the sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleSidebar])

  return (
    <>
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center gap-2 border-b border-border px-4 lg:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Loop</span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}
