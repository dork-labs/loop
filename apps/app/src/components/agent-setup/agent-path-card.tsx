import React from 'react';

interface AgentPathCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

/** Reusable card for displaying an agent integration path. */
export function AgentPathCard({ icon, title, description, children }: AgentPathCardProps) {
  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="bg-muted flex size-8 items-center justify-center rounded-md">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
