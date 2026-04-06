import { SM2Result } from '@/types';

/**
 * SM-2 Spaced Repetition Algorithm
 * quality: 0-5
 *   0 = complete blackout (もう一度 / hard fail)
 *   1 = incorrect, but remembered on hint
 *   2 = incorrect, easy to recall
 *   3 = correct with difficulty (もう一度 / soft)
 *   4 = correct (覚えた)
 *   5 = perfect recall (覚えた / easy)
 */
export function sm2(
  quality: number,         // 0-5
  currentInterval: number, // days
  currentEF: number,       // ease factor (default 2.5)
  currentMastery: number   // 0-5
): SM2Result {
  // Clamp quality
  const q = Math.max(0, Math.min(5, quality));

  // Update ease factor
  let newEF = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  // Calculate next interval
  let newInterval: number;
  if (q < 3) {
    // Failed: reset to beginning
    newInterval = 1;
  } else if (currentInterval === 0) {
    newInterval = 1;
  } else if (currentInterval === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(currentInterval * newEF);
  }

  // Update mastery (0-5 scale)
  let newMastery = currentMastery;
  if (q >= 4) {
    newMastery = Math.min(5, currentMastery + 1);
  } else if (q < 3) {
    newMastery = Math.max(0, currentMastery - 1);
  }

  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  const nextReviewDate = nextDate.toISOString().split('T')[0];

  return {
    interval: newInterval,
    easeFactor: Math.round(newEF * 100) / 100,
    nextReviewDate,
    mastery: newMastery,
  };
}

/** Map "覚えた" / "もう一度" to quality score */
export function getQuality(remembered: boolean, easy = false): number {
  if (!remembered) return 1;   // もう一度
  if (easy) return 5;
  return 4;                    // 覚えた
}

/** Check if a card is due today */
export function isDue(nextReviewDate: string | null): boolean {
  if (!nextReviewDate) return true; // Never reviewed → always due
  const today = new Date().toISOString().split('T')[0];
  return nextReviewDate <= today;
}
