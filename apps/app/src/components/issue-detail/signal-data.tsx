import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SignalDataProps {
  source: string | null;
  payload: Record<string, unknown>;
}

/** Signal source badge and collapsible raw payload block. */
export function SignalData({ source, payload }: SignalDataProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Signal Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {source && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Source</span>
            <Badge variant="outline">{source}</Badge>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {isExpanded ? 'Hide' : 'Show'} raw payload
        </button>

        {isExpanded && (
          <pre className="bg-muted text-foreground/80 overflow-x-auto rounded-md p-4 text-xs">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
