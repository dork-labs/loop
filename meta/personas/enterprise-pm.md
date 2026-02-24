# The Enterprise PM — Not Loop's User

> "Can it integrate with Jira? We need custom workflow states, approval gates, and SOC 2 compliance reporting."

**Role**: `anti-persona`
**Confidence**: `proto-persona`

---

## Who This Is

A non-technical product manager or project manager at a mid-to-large company (50-500+ people). They manage engineering work through traditional PM tools (Jira, Asana, Monday.com) and think in sprints, epics, story points, and velocity charts. They:

- Don't use AI coding agents (or are just starting to explore Copilot)
- Manage work through human-centric workflows: standups, sprint planning, retrospectives
- Need RBAC, audit trails, compliance features, and SSO
- Evaluate tools based on integration with their existing enterprise stack (Jira, Confluence, Slack, Okta)
- Think "project management" when they hear "issue tracking"

---

## Why They're Not Loop's User

1. **Fundamentally different mental model** — Loop organizes work around signals, hypotheses, and autonomous agent dispatch. The Enterprise PM organizes work around sprints, story points, and human assignment. These are incompatible paradigms, not just different UIs.
2. **No agents in the loop** — Loop's core value requires AI agents polling the dispatch endpoint and executing work autonomously. Without agents, Loop is just a worse Linear. This person doesn't have agents.
3. **Feature expectations mismatch** — They expect custom workflow states, Gantt charts, time tracking, resource allocation, sprint velocity, and burndown charts. Loop will never build these because they're orthogonal to the product's purpose.
4. **Procurement and compliance** — They need SSO, RBAC, audit logs, data residency guarantees, and vendor security questionnaires. Building for enterprise procurement distorts early-stage product priorities.

---

## The Danger of Building for This Persona

If Loop tries to accommodate the Enterprise PM, it will:
- Add workflow customization (custom states, approval gates, transitions) that complicates the simple issue lifecycle
- Build sprint/epic/initiative hierarchies that conflict with the flat signal → hypothesis → task model
- Invest in RBAC, SSO, and compliance features before the core loop is proven
- Shift messaging from "autonomous product engine" to "AI-enhanced project management" — a crowded, commodity market
- Attract users who will churn because Loop doesn't do what Jira does, generating misleading feedback

**The rule:** If a feature request sounds like it belongs in Jira, Linear, or Asana, it doesn't belong in Loop. Loop is not a project management tool — it's a product development engine that happens to track issues.

---

## When This Might Change

The Enterprise PM becomes relevant only if:
- Loop proves its value at startups and starts getting pulled upmarket
- A "team lead" persona emerges who uses Loop for agent orchestration but needs lightweight access controls
- Enterprise companies adopt AI agent fleets at scale and need Loop-style dispatch

This is a v2.0+ concern at earliest. For now, enterprise features are a distraction.

---

## Research Basis

- **Data sources:** Litepaper competitive positioning (Linear, Jira mentioned as PM tools that don't close the loop), MVP scope doc (multi-user auth explicitly deferred), product architecture (no workflow engine by design)
- **Confidence level:** Proto-persona (assumption-based)
- **Key assumption to validate:** That there isn't a "technical PM" segment — an engineering manager who uses AI agents AND thinks in sprints — who could bridge both worlds
- **Created:** 2026-02-23
- **Next review:** 2026-08-23
