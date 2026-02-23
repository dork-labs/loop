import { text, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';
import { cuid2Id } from './_helpers';

export const signalSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export const signalSeverityEnum = pgEnum('signal_severity', signalSeverityValues);

/** Signals table — raw inbound data from external providers (PostHog, GitHub, Sentry, etc.). */
export const signals = pgTable(
  'signals',
  {
    ...cuid2Id,
    source: text('source').notNull(),
    sourceId: text('source_id'),
    type: text('type').notNull(),
    severity: signalSeverityEnum('severity').notNull(),
    payload: jsonb('payload').notNull(),
    issueId: text('issue_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_signals_issue_id').on(table.issueId),
    index('idx_signals_source').on(table.source),
    index('idx_signals_payload_gin').using('gin', table.payload),
  ]
);
