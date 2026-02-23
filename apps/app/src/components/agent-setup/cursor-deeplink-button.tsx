import { buildCursorDeeplink, buildCursorWebDeeplink } from '@/lib/deeplink-builders';

interface CursorDeeplinkButtonProps {
  apiUrl: string;
  apiKey: string;
}

/** "Add to Cursor" button with one-click MCP install deeplink and web fallback. */
export function CursorDeeplinkButton({ apiUrl, apiKey }: CursorDeeplinkButtonProps) {
  const deeplinkHref = buildCursorDeeplink(apiUrl, apiKey);
  const webHref = buildCursorWebDeeplink(apiUrl, apiKey);

  return (
    <div className="space-y-2">
      <a
        href={deeplinkHref}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        Add to Cursor
      </a>
      <p className="text-muted-foreground text-xs">
        Doesn&apos;t work?{' '}
        <a
          href={webHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Try the web link
        </a>
      </p>
    </div>
  );
}
