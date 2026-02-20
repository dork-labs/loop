import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HypothesisData as HypothesisDataType } from '@/types/issues'

/** Color class for the confidence meter fill based on 0-1 value. */
function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'bg-green-500'
  if (confidence >= 0.4) return 'bg-yellow-500'
  return 'bg-red-500'
}

/** Hypothesis statement, confidence meter, evidence list, and validation criteria. */
export function HypothesisData({ data }: { data: HypothesisDataType }) {
  const pct = Math.round(data.confidence * 100)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Hypothesis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Statement</p>
          <p className="text-sm">{data.statement}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Confidence
            </p>
            <span className="font-mono text-sm">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${confidenceColor(data.confidence)} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {data.evidence.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence
            </p>
            <ul className="space-y-1">
              {data.evidence.map((item, idx) => (
                // Evidence items are plain strings without stable IDs — index key is appropriate
                <li key={idx} className="flex gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Validation Criteria
          </p>
          <p className="text-sm text-muted-foreground">{data.validationCriteria}</p>
        </div>

        {data.prediction && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prediction
            </p>
            <p className="text-sm text-muted-foreground">{data.prediction}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
