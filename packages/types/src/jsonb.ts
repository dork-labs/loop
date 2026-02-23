import { z } from 'zod';

export const hypothesisDataSchema = z.object({
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  validationCriteria: z.string(),
  prediction: z.string().optional(),
});
export type HypothesisData = z.infer<typeof hypothesisDataSchema>;

export const commitRefSchema = z.object({
  sha: z.string(),
  message: z.string(),
  url: z.string().optional(),
  author: z.string().optional(),
  timestamp: z.string().optional(),
});
export type CommitRef = z.infer<typeof commitRefSchema>;

export const pullRequestRefSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string().optional(),
  state: z.string().optional(),
  mergedAt: z.string().optional(),
});
export type PullRequestRef = z.infer<typeof pullRequestRefSchema>;

export type SignalPayload = Record<string, unknown>;

export const templateConditionsSchema = z
  .object({
    type: z.string().optional(),
    signalSource: z.string().optional(),
    labels: z.array(z.string()).optional(),
    projectId: z.string().optional(),
    hasFailedSessions: z.boolean().optional(),
    hypothesisConfidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type TemplateConditions = z.infer<typeof templateConditionsSchema>;
