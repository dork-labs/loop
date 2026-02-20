/** Shared Handlebars partials registered during initHandlebars(). */
export const PARTIALS: Record<string, string> = {
  api_reference: `## Loop API Reference

Base URL: {{loopUrl}}
Auth: \`Authorization: Bearer {{loopToken}}\`

### Create Issue
\`\`\`
curl -X POST {{loopUrl}}/api/issues \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "...", "type": "task", "parentId": "{{issue.parentId}}"}'
\`\`\`

### Update Issue Status
\`\`\`
curl -X PATCH {{loopUrl}}/api/issues/{{issue.id}} \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "done", "agentSummary": "..."}'
\`\`\`

### Add Comment
\`\`\`
curl -X POST {{loopUrl}}/api/issues/{{issue.id}}/comments \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"body": "...", "authorName": "Agent", "authorType": "agent"}'
\`\`\`

### Create Relation
\`\`\`
curl -X POST {{loopUrl}}/api/issues/{{issue.id}}/relations \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "blocks", "relatedIssueId": "..."}'
\`\`\``,

  review_instructions: `## After Completion

Rate the quality of these instructions:

\`\`\`
curl -X POST {{loopUrl}}/api/prompt-reviews \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "versionId": "{{meta.versionId}}",
    "issueId": "{{issue.id}}",
    "clarity": <1-5>,
    "completeness": <1-5>,
    "relevance": <1-5>,
    "feedback": "<what was missing, confusing, or unnecessary>"
  }'
\`\`\``,

  parent_context: `{{#if parent}}
## Parent Issue
#{{parent.number}} [{{parent.type}}]: {{parent.title}}
{{#if parent.description}}
{{parent.description}}
{{/if}}
{{#if parent.hypothesis}}
Hypothesis: {{parent.hypothesis.statement}} (confidence: {{parent.hypothesis.confidence}})
Validation: {{parent.hypothesis.validationCriteria}}
{{/if}}
{{/if}}`,

  sibling_context: `{{#if siblings.length}}
## Sibling Issues
{{#each siblings}}
- #{{this.number}} [{{this.status}}]: {{this.title}}
{{/each}}
{{/if}}`,

  project_and_goal_context: `{{#if project}}
## Project
{{project.name}}
{{#if project.description}}
{{project.description}}
{{/if}}
{{#if goal}}
### Goal
{{goal.title}}
Progress: {{goal.currentValue}}{{goal.unit}} / {{goal.targetValue}}{{goal.unit}}
Status: {{goal.status}}
{{/if}}
{{/if}}`,
}
