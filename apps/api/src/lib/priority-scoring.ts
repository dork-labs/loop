/** Priority level -> score weight */
export const PRIORITY_WEIGHTS: Record<number, number> = {
  1: 100, // urgent
  2: 75, // high
  3: 50, // medium
  4: 25, // low
  0: 10, // none
}

/** Issue type -> score bonus */
export const TYPE_WEIGHTS: Record<string, number> = {
  signal: 50,
  hypothesis: 40,
  plan: 30,
  task: 20,
  monitor: 10,
}

/** Bonus when issue's project has an active goal */
export const GOAL_ALIGNMENT_BONUS = 20

/** Score increase per day in todo status */
export const AGE_BONUS_PER_DAY = 1

export interface ScoreBreakdown {
  priorityWeight: number
  goalAlignmentBonus: number
  ageBonus: number
  typeBonus: number
  total: number
}

export interface ScoringInput {
  priority: number
  type: string
  createdAt: Date
  hasActiveGoal: boolean
}

/** Compute deterministic priority score for an issue. */
export function scoreIssue(input: ScoringInput): ScoreBreakdown {
  const priorityWeight = PRIORITY_WEIGHTS[input.priority] ?? 10
  const typeBonus = TYPE_WEIGHTS[input.type] ?? 0
  const goalAlignmentBonus = input.hasActiveGoal ? GOAL_ALIGNMENT_BONUS : 0
  const ageBonus =
    Math.floor((Date.now() - input.createdAt.getTime()) / 86_400_000) * AGE_BONUS_PER_DAY
  const total = priorityWeight + typeBonus + goalAlignmentBonus + ageBonus

  return { priorityWeight, goalAlignmentBonus, ageBonus, typeBonus, total }
}
