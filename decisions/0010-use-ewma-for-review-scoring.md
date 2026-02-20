---
number: 10
title: Use EWMA for prompt review score tracking
status: proposed
created: 2026-02-20
spec: prompt-dispatch-engine
superseded-by: null
---

# 10. Use EWMA for prompt review score tracking

## Status

Proposed

## Context

Prompt versions accumulate review scores from agents after each dispatch. The system needs to detect prompt quality degradation and trigger improvement issues when scores drop below a threshold (3.5/5). Options considered: simple average (dilutes recent bad reviews with old good ones — slow to detect degradation), windowed average (last N reviews — requires redundant storage), EWMA (exponentially weighted moving average — O(1) compute, weights recent reviews more heavily).

## Decision

Use EWMA with alpha=0.3 on the raw 1-5 scale. Composite score = `(clarity + completeness + relevance) / 3`. Update formula: `new = 0.3 * incoming + 0.7 * old`. First review sets the score directly. Minimum 3 reviews (`REVIEW_MIN_SAMPLES`) before threshold checks to prevent single-review triggers.

## Consequences

### Positive

- O(1) storage and compute — single multiply-add per review, no aggregation queries
- Detects quality drift faster than simple averages — recent reviews have 3x the weight of reviews 5 iterations ago
- Same algorithm used by monitoring systems (Redis latency tracking, EWMA control charts)
- Raw 1-5 scale is human-readable when querying the database directly

### Negative

- A single very bad review has outsized impact with alpha=0.3 (mitigated by min-samples=3)
- Not perfectly reproducible from review history alone — EWMA is path-dependent
- Alpha value (0.3) may need tuning based on observed false-positive improvement issue rates
