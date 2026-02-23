import { describe, it, expect } from 'vitest';
import {
  scoreIssue,
  PRIORITY_WEIGHTS,
  TYPE_WEIGHTS,
  GOAL_ALIGNMENT_BONUS,
  AGE_BONUS_PER_DAY,
} from '../lib/priority-scoring';

describe('scoreIssue', () => {
  // 1. Score calculation correctness:
  //    Given priority=2 (high), type='signal', hasActiveGoal=true, created 3 days ago
  //    -> verify exact score breakdown: 75 + 50 + 20 + 3 = 148
  it('computes correct total for high-priority signal with goal alignment', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const result = scoreIssue({
      priority: 2,
      type: 'signal',
      createdAt: threeDaysAgo,
      hasActiveGoal: true,
    });
    expect(result.priorityWeight).toBe(75);
    expect(result.typeBonus).toBe(50);
    expect(result.goalAlignmentBonus).toBe(20);
    expect(result.ageBonus).toBe(3);
    expect(result.total).toBe(148);
  });

  // 2. Priority weight mapping: Test all 5 priority levels
  it.each([
    [1, 100],
    [2, 75],
    [3, 50],
    [4, 25],
    [0, 10],
  ])('maps priority %i to weight %i', (priority, expected) => {
    const result = scoreIssue({
      priority,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    });
    expect(result.priorityWeight).toBe(expected);
  });

  // 3. Type weight mapping: Test all 5 issue types
  it.each([
    ['signal', 50],
    ['hypothesis', 40],
    ['plan', 30],
    ['task', 20],
    ['monitor', 10],
  ])('maps type %s to bonus %i', (type, expected) => {
    const result = scoreIssue({
      priority: 0,
      type,
      createdAt: new Date(),
      hasActiveGoal: false,
    });
    expect(result.typeBonus).toBe(expected);
  });

  // 4. Unknown priority/type: fallback to defaults (10 and 0)
  it('falls back to default weight for unknown priority', () => {
    const result = scoreIssue({
      priority: 99,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    });
    expect(result.priorityWeight).toBe(10);
  });

  it('falls back to zero bonus for unknown type', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'unknown_type',
      createdAt: new Date(),
      hasActiveGoal: false,
    });
    expect(result.typeBonus).toBe(0);
  });

  // 5. Age bonus accumulation: 0 days, 30 days, 365 days
  it('returns zero age bonus for just-created issue', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    });
    expect(result.ageBonus).toBe(0);
  });

  it('returns 30 age bonus for 30-day-old issue', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: thirtyDaysAgo,
      hasActiveGoal: false,
    });
    expect(result.ageBonus).toBe(30);
  });

  it('returns 365 age bonus for 1-year-old issue', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 86_400_000);
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: oneYearAgo,
      hasActiveGoal: false,
    });
    expect(result.ageBonus).toBe(365);
  });

  // 6. Goal alignment: with and without active goal
  it('adds goal alignment bonus when hasActiveGoal is true', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: true,
    });
    expect(result.goalAlignmentBonus).toBe(GOAL_ALIGNMENT_BONUS);
  });

  it('adds zero goal bonus when hasActiveGoal is false', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    });
    expect(result.goalAlignmentBonus).toBe(0);
  });
});
