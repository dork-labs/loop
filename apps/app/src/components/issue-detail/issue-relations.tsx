import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IssueRelation, RelationType } from '@/types/issues'

const RELATION_LABELS: Record<RelationType, string> = {
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  related: 'Related',
  duplicate: 'Duplicate of',
}

/** Groups relations by their type for display. */
function groupByType(relations: IssueRelation[]): Record<RelationType, IssueRelation[]> {
  const groups = {} as Record<RelationType, IssueRelation[]>
  for (const rel of relations) {
    if (!groups[rel.type]) groups[rel.type] = []
    groups[rel.type].push(rel)
  }
  return groups
}

/** Sidebar card showing issue relations grouped by relation type. */
export function IssueRelations({ relations }: { relations: IssueRelation[] }) {
  const grouped = groupByType(relations)
  const types = Object.keys(grouped) as RelationType[]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Relations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {types.map((type) => (
          <div key={type} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{RELATION_LABELS[type]}</p>
            <ul className="space-y-1">
              {grouped[type].map((rel) => (
                <li key={rel.id}>
                  {rel.relatedIssue ? (
                    <Link
                      to="/issues/$issueId"
                      params={{ issueId: rel.relatedIssueId }}
                      className="text-sm text-primary hover:underline"
                    >
                      #{rel.relatedIssue.number} {rel.relatedIssue.title}
                    </Link>
                  ) : (
                    <span className="font-mono text-sm text-muted-foreground">
                      {rel.relatedIssueId}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
