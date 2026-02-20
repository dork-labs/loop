-- Seed default prompt templates and initial versions
-- Idempotent: uses ON CONFLICT DO NOTHING for safe re-runs

-- 1. Signal Triage
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_signal_triage',
  'signal-triage',
  'Signal Triage',
  'Default template for triaging incoming signals. Analyzes the signal, determines if actionable, and creates a hypothesis if warranted.',
  '{"type": "signal"}',
  10,
  'ver_default_signal_triage_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_signal_triage_v1',
  'tpl_default_signal_triage',
  1,
  E'# Signal Triage: {{issue.title}}\n\nYou are triaging signal #{{issue.number}}.\n\n## Signal Data\n{{json issue.signalPayload}}\n\nSource: {{issue.signalSource}}\n\n{{> parent_context}}\n{{> project_and_goal_context}}\n\n## Instructions\n\n1. Analyze the signal data above\n2. Determine if this signal is actionable\n3. If actionable, create a hypothesis issue as a child of this signal\n4. Update this issue status to \"done\" with a summary of your analysis\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 2. Hypothesis Planning
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_hypothesis_planning',
  'hypothesis-planning',
  'Hypothesis Planning',
  'Default template for planning hypothesis validation. Decomposes the hypothesis into actionable tasks.',
  '{"type": "hypothesis"}',
  10,
  'ver_default_hypothesis_planning_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_hypothesis_planning_v1',
  'tpl_default_hypothesis_planning',
  1,
  E'# Hypothesis Planning: {{issue.title}}\n\nYou are planning validation for hypothesis #{{issue.number}}.\n\n{{#if issue.hypothesis}}\n## Hypothesis\nStatement: {{issue.hypothesis.statement}}\nConfidence: {{issue.hypothesis.confidence}}\nValidation Criteria: {{issue.hypothesis.validationCriteria}}\n{{#if issue.hypothesis.prediction}}\nPrediction: {{issue.hypothesis.prediction}}\n{{/if}}\n{{/if}}\n\n{{> parent_context}}\n{{> sibling_context}}\n{{> project_and_goal_context}}\n\n## Instructions\n\n1. Review the hypothesis and validation criteria\n2. Decompose into concrete tasks (create child issues)\n3. Set up blocking relations so tasks execute in correct order\n4. Update this issue status to \"done\" with your plan summary\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 3. Task Execution
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_task_execution',
  'task-execution',
  'Task Execution',
  'Default template for executing concrete tasks. Provides implementation guidance and reporting instructions.',
  '{"type": "task"}',
  10,
  'ver_default_task_execution_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_task_execution_v1',
  'tpl_default_task_execution',
  1,
  E'# Task Execution: {{issue.title}}\n\nYou are executing task #{{issue.number}}.\n\n{{#if issue.description}}\n## Description\n{{issue.description}}\n{{/if}}\n\n{{> parent_context}}\n{{> sibling_context}}\n{{> project_and_goal_context}}\n\n{{#if blockedBy.length}}\n## Blocked By\n{{#each blockedBy}}\n- #{{this.number}}: {{this.title}}\n{{/each}}\n{{/if}}\n\n{{#if previousSessions.length}}\n## Previous Sessions\n{{#each previousSessions}}\nStatus: {{this.status}}\n{{#if this.agentSummary}}Summary: {{this.agentSummary}}{{/if}}\n{{/each}}\n{{/if}}\n\n## Instructions\n\n1. Implement the task described above\n2. Add comments to track your progress\n3. When complete, update status to \"done\" with an agent summary\n4. If you create sub-tasks, add them as child issues\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 4. Plan Decomposition
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_plan_decomposition',
  'plan-decomposition',
  'Plan Decomposition',
  'Default template for decomposing plans into tasks. Breaks down a plan into ordered, actionable work items.',
  '{"type": "plan"}',
  10,
  'ver_default_plan_decomposition_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_plan_decomposition_v1',
  'tpl_default_plan_decomposition',
  1,
  E'# Plan Decomposition: {{issue.title}}\n\nYou are decomposing plan #{{issue.number}} into actionable tasks.\n\n{{#if issue.description}}\n## Plan Description\n{{issue.description}}\n{{/if}}\n\n{{> parent_context}}\n{{> sibling_context}}\n{{> project_and_goal_context}}\n\n## Instructions\n\n1. Analyze the plan and break it into concrete tasks\n2. Create child issues for each task\n3. Set up blocking relations for ordering dependencies\n4. Assign appropriate priority levels to each task\n5. Update this issue status to \"done\" with decomposition summary\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 5. Monitor Check
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_monitor_check',
  'monitor-check',
  'Monitor Check',
  'Default template for monitoring checks. Reviews metrics and creates signals if thresholds are breached.',
  '{"type": "monitor"}',
  10,
  'ver_default_monitor_check_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_monitor_check_v1',
  'tpl_default_monitor_check',
  1,
  E'# Monitor Check: {{issue.title}}\n\nYou are performing monitor check #{{issue.number}}.\n\n{{#if issue.description}}\n## Monitor Description\n{{issue.description}}\n{{/if}}\n\n{{> project_and_goal_context}}\n\n{{#if previousSessions.length}}\n## Previous Checks\n{{#each previousSessions}}\nStatus: {{this.status}}\n{{#if this.agentSummary}}Summary: {{this.agentSummary}}{{/if}}\n{{/each}}\n{{/if}}\n\n## Instructions\n\n1. Review the monitoring criteria described above\n2. Check relevant metrics and data sources\n3. If thresholds are breached, create a signal issue via the API\n4. Add a comment summarizing your findings\n5. Update status to \"done\" with your monitoring summary\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;
