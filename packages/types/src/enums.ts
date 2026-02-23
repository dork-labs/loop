import { z } from 'zod';

export const issueTypeValues = ['signal', 'hypothesis', 'plan', 'task', 'monitor'] as const;
export const issueTypeSchema = z.enum(issueTypeValues);
export type IssueType = z.infer<typeof issueTypeSchema>;

export const issueStatusValues = [
  'triage',
  'backlog',
  'todo',
  'in_progress',
  'done',
  'canceled',
] as const;
export const issueStatusSchema = z.enum(issueStatusValues);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const relationTypeValues = ['blocks', 'blocked_by', 'related', 'duplicate'] as const;
export const relationTypeSchema = z.enum(relationTypeValues);
export type RelationType = z.infer<typeof relationTypeSchema>;

export const authorTypeValues = ['human', 'agent'] as const;
export const authorTypeSchema = z.enum(authorTypeValues);
export type AuthorType = z.infer<typeof authorTypeSchema>;

export const projectStatusValues = [
  'backlog',
  'planned',
  'active',
  'paused',
  'completed',
  'canceled',
] as const;
export const projectStatusSchema = z.enum(projectStatusValues);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectHealthValues = ['on_track', 'at_risk', 'off_track'] as const;
export const projectHealthSchema = z.enum(projectHealthValues);
export type ProjectHealth = z.infer<typeof projectHealthSchema>;

export const goalStatusValues = ['active', 'achieved', 'abandoned'] as const;
export const goalStatusSchema = z.enum(goalStatusValues);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const signalSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export const signalSeveritySchema = z.enum(signalSeverityValues);
export type SignalSeverity = z.infer<typeof signalSeveritySchema>;

export const versionStatusValues = ['active', 'draft', 'retired'] as const;
export const versionStatusSchema = z.enum(versionStatusValues);
export type VersionStatus = z.infer<typeof versionStatusSchema>;
