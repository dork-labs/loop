/** Sentinel comment used to detect if the Loop block has already been appended. */
export const CLAUDE_MD_SENTINEL = '<!-- loop-connect -->';

/** CLAUDE.md append block with Loop integration context. */
export const CLAUDE_MD_BLOCK = `
${CLAUDE_MD_SENTINEL}
## Loop Integration

This project uses [Loop](https://looped.me) as its autonomous improvement engine.
Loop manages issues, signals, projects, and prompt templates via a REST API.

- **Auth:** \`Authorization: Bearer $LOOP_API_KEY\` (stored in \`.env.local\`)
- **API URL:** Configured in \`.env.local\` as \`LOOP_API_URL\`
- **MCP Server:** Configured in \`.mcp.json\` — provides \`loop_get_next_task\`, \`loop_complete_task\`, and more
- **Docs:** https://www.looped.me/docs
- **Dashboard:** https://app.looped.me
`;
