import { Flashcard } from '@/types';
import { isDue } from '@/lib/schedule';
import { todayJST } from '@/lib/date';

/**
 * 1日に出す上限。
 * 期限切れが何百件と溜まっとる状態で全部見せても、多すぎて手が止まるだけやった。
 * 「今日これだけ終わらせたら終わり」と言い切れる量に絞る。
 */
export const DAILY_LIMIT = 30;

const studyCards = (cards: Flashcard[]) => cards.filter((c) => !c.isDraft);

/**
 * 今日出すカードを、出す順に並べて上限まで返す。
 *
 * 未学習を先頭に置くのは、拾ったばかりのフレーズを最初の24時間以内に1回やるため
 * （エビングハウスの節約率が一番きつく落ちるのがそこ）。そのあとは期限が古い順で、
 * 溜まった分を端から消していく。
 */
export function buildTodayQueue(cards: Flashcard[], limit: number = DAILY_LIMIT): Flashcard[] {
  const due = studyCards(cards).filter((c) => isDue(c.nextReviewDate));

  const fresh = due.filter((c) => !c.nextReviewDate);
  const overdue = due
    .filter((c) => c.nextReviewDate)
    .sort((a, b) => a.nextReviewDate!.localeCompare(b.nextReviewDate!));

  return [...fresh, ...overdue].slice(0, limit);
}

export interface TodayProgress {
  /** 今日すでに復習した枚数 */
  done: number;
  /** 今日ぶんの総仕事量。これを分母にする */
  goal: number;
  /** done / goal (%) */
  pct: number;
}

/**
 * 今日の達成度。
 *
 * 分母を「残り件数」にすると、1枚やるたびに次回復習日が未来へ飛んで対象から外れるので、
 * 目標そのものが減っていってしまう。済んだ分と残りの合計を分母にすると、その日の
 * 仕事量が固定される。上限で頭打ちにするのは、デッキが上限どおりにしか出えへんから。
 */
export function todayProgress(cards: Flashcard[], limit: number = DAILY_LIMIT): TodayProgress {
  const study = studyCards(cards);
  const today = todayJST();

  const done = study.filter((c) => c.latestReviewDate === today).length;
  const stillDue = study.filter((c) => isDue(c.nextReviewDate)).length;

  const goal = Math.min(limit, done + stillDue);

  // やることが無い日を 0% にすると、終わっとるのに未達に見える
  const pct = goal > 0 ? Math.round((done / goal) * 100) : 100;

  return { done, goal, pct };
}

/** 期限が来ているカードの総数。上限で切る前の、溜まっとる実数 */
export function backlogCount(cards: Flashcard[]): number {
  return studyCards(cards).filter((c) => isDue(c.nextReviewDate)).length;
}

/** 習熟度(0〜5)ごとの枚数。段階表の並びそのままで返す */
export function masteryBreakdown(cards: Flashcard[]): number[] {
  const counts = new Array(6).fill(0);

  for (const c of studyCards(cards)) {
    const step = Math.max(0, Math.min(5, Math.round(c.mastery ?? 0)));
    counts[step]++;
  }

  return counts;
}
