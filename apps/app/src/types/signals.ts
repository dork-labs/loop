/** Discriminated union values matching the `signal_severity` postgres enum. */
export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * A raw inbound signal from an external provider (PostHog, GitHub, Sentry, etc.).
 * Each signal is linked to exactly one issue via `issueId`.
 */
export interface Signal {
  id: string
  source: string
  sourceId: string | null
  type: string
  severity: SignalSeverity
  payload: Record<string, unknown>
  issueId: string
  createdAt: string
}
