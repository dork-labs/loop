import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiClient } from '../types.js'
import { handleToolCall } from './error-handler.js'

/**
 * Register the `loop_ingest_signal` tool on the MCP server.
 *
 * @param server - The MCP server to register the tool on
 * @param client - Authenticated API client for Loop
 */
export function registerIngestSignal(server: McpServer, client: ApiClient): void {
  // @ts-expect-error TS2589 — MCP SDK server.tool() overload inference with complex Zod schemas
  server.tool(
    'loop_ingest_signal',
    'Ingest a signal (error, metric change, user feedback) into Loop. Creates a signal and a linked triage issue.',
    {
      source: z
        .string()
        .describe('Signal source (e.g., "agent", "posthog", "sentry")'),
      type: z
        .string()
        .describe(
          'Signal type (e.g., "error", "metric_change", "user_feedback")',
        ),
      severity: z
        .enum(['critical', 'high', 'medium', 'low'])
        .optional()
        .describe('Signal severity (default: medium)'),
      payload: z
        .record(z.unknown())
        .describe('Signal data as key-value pairs'),
      projectId: z.string().optional(),
    },
    { readOnlyHint: false, idempotentHint: false },
    async ({ source, type, severity, payload, projectId }) => {
      return handleToolCall(async () => {
        const response = await client
          .post('api/signals', {
            json: {
              source,
              type,
              severity: severity ?? 'medium',
              payload,
              ...(projectId && { projectId }),
            },
          })
          .json<{
            data: {
              signal: { id: string; source: string }
              issue: {
                id: string
                number: number
                title: string
                status: string
              }
            }
          }>()

        const { signal, issue } = response.data

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ signal, issue }, null, 2),
            },
          ],
        }
      })
    },
  )
}
