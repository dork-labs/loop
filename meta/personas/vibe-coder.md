# The Vibe Coder — Not Loop's User (Yet)

> "I just want to describe what I want and have the AI build it. I don't want to think about feedback loops or hypotheses."

**Role**: `anti-persona`
**Confidence**: `proto-persona`

---

## Who This Is

A non-technical or barely-technical person who builds products using AI-first tools like Lovable, Bolt.new, or v0. They describe what they want in natural language and the tool generates it. They may call themselves a "founder" or "builder" but they:

- Cannot run terminal commands (`npx`, `git`, `curl`)
- Don't know what an environment variable or API key is
- Don't use GitHub, PostHog, or Sentry
- Think in features and screens, not in hypotheses and metrics
- Want a visual, no-code experience for everything

---

## Why They're Not Loop's User

1. **Integration barrier** — Loop requires webhook configuration, API keys, and CLI tooling. This person can't complete the setup without significant hand-holding that Loop doesn't provide.
2. **Conceptual mismatch** — Loop's core concepts (signals, triage, hypotheses, prompt templates, dispatch queues) require engineering literacy. This person thinks in "pages" and "features," not in "issues" and "validation criteria."
3. **Agent mismatch** — Loop is designed for agents that make HTTP calls, write code, and create PRs. This person's "agent" is a visual builder that generates complete apps from prompts. The pull architecture doesn't apply to their workflow.
4. **Value prop doesn't land** — "Close the feedback loop" and "Build-Measure-Learn automation" assume the user already has a mental model of product development methodology. This person is learning what product development *is*.

---

## When This Might Change

This anti-persona is explicitly *for now*. If Loop adds:
- A fully hosted, zero-config cloud version (no `npx`, no env vars)
- Visual webhook setup (click-to-connect PostHog, not paste a URL)
- A simplified "guided mode" that translates Loop concepts into plain language
- Integration with visual builders (Lovable, Bolt.new) as agent platforms

...then this segment could become a viable secondary persona. But that's v1.0+, not MVP.

---

## The Danger of Building for This Persona

If Loop tries to accommodate the vibe coder now, it will:
- Dilute the CLI-first, developer-native DX that the primary and secondary personas value
- Add onboarding complexity (tutorials, tooltips, guided tours) that slows down technical users
- Shift product language from precise technical terms to vague abstractions
- Spread development effort across two fundamentally different UX paradigms

**The rule:** If a product decision would help the vibe coder but slow down Lena or Luis, don't do it.

---

## Research Basis

- **Data sources:** Developer onboarding research (tier stratification), brand foundation ("not for casual users"), current FTUE requirements analysis
- **Confidence level:** Proto-persona (assumption-based)
- **Key assumption to validate:** That there isn't a meaningful segment of semi-technical users (Cursor power users, for instance) who *could* use Loop with a slightly smoother onboarding — this assumption should be tested before the 6-month review
- **Created:** 2026-02-23
- **Next review:** 2026-08-23
