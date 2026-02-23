import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Comment, AuthorType } from '@/types/issues';

const AUTHOR_TYPE_COLORS: Record<AuthorType, string> = {
  human: 'bg-blue-500/20 text-blue-400',
  agent: 'bg-violet-500/20 text-violet-400',
};

/** Returns a relative time string (e.g. "2h ago"). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Returns initials from an author name for the avatar fallback. */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  // Cap indent depth at 3 to avoid excessive nesting
  const indentClass = depth > 0 ? 'ml-8 border-l border-border pl-4' : '';

  return (
    <div className={indentClass}>
      <div className="space-y-2 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">{initials(comment.authorName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{comment.authorName}</span>
          <Badge className={AUTHOR_TYPE_COLORS[comment.authorType]}>{comment.authorType}</Badge>
          <span className="text-muted-foreground text-xs">{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="text-foreground/90 text-sm whitespace-pre-wrap">{comment.body}</p>
      </div>

      {comment.children && comment.children.length > 0 && (
        <div className="space-y-0">
          {comment.children.map((child) => (
            <CommentItem key={child.id} comment={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Threaded comment display. Top-level comments contain nested children. */
export function IssueComments({ comments }: { comments: Comment[] }) {
  // Only render top-level comments here; children are handled recursively
  const topLevel = comments.filter((c) => c.parentId === null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Comments ({comments.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-border divide-y">
        {topLevel.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </CardContent>
    </Card>
  );
}
