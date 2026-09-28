import { describe, it, expect } from 'vitest';
import {
  backlogCount,
  buildTodayQueue,
  DAILY_LIMIT,
  masteryBreakdown,
  todayProgress,
} from './deck';
import { addDaysJST, todayJST } from './date';
import { Flashcard } from '@/types';

/** テストで気にするのは日付と id だけなので、それ以外は埋め草 */
function card(id: string, nextReviewDate: string | null, latestReviewDate: string | null = null): Flashcard {
  return {
    id,
    phrase: id,
    meaning: 'いみ',
    example: '',
    show: 'SUITS',
    latestReviewDate,
    nextReviewDate,
    mastery: 0,
    interval: 0,
    isDraft: false,
  };
}

const ids = (cards: Flashcard[]) => cards.map((c) => c.id);

describe('buildTodayQueue', () => {
  it('未学習を期限切れより先に出す', () => {
    const queue = buildTodayQueue([
      card('overdue', addDaysJST(-10)),
      card('fresh', null),
    ]);

    expect(ids(queue)).toEqual(['fresh', 'overdue']);
  });

  it('期限切れは古い順に並べる', () => {
    const queue = buildTodayQueue([
      card('b', addDaysJST(-5)),
      card('c', addDaysJST(-1)),
      card('a', addDaysJST(-30)),
    ]);

    expect(ids(queue)).toEqual(['a', 'b', 'c']);
  });

  it('上限で切る', () => {
    const cards = Array.from({ length: 50 }, (_, i) => card(`c${i}`, addDaysJST(-i - 1)));

    expect(buildTodayQueue(cards)).toHaveLength(DAILY_LIMIT);
  });

  it('上限は引数で変えられる', () => {
    const cards = Array.from({ length: 50 }, (_, i) => card(`c${i}`, addDaysJST(-i - 1)));

    expect(buildTodayQueue(cards, 5)).toHaveLength(5);
  });

  it('対象が上限より少なければ全部返す', () => {
    const queue = buildTodayQueue([card('a', addDaysJST(-1)), card('b', null)]);

    expect(queue).toHaveLength(2);
  });

  it('復習日が未来のカードは出さない', () => {
    const queue = buildTodayQueue([card('future', addDaysJST(1)), card('due', addDaysJST(-1))]);

    expect(ids(queue)).toEqual(['due']);
  });

  it('復習日が今日ちょうどのカードは出す', () => {
    const queue = buildTodayQueue([card('today', todayJST())]);

    expect(ids(queue)).toEqual(['today']);
  });

  it('空配列でも落ちない', () => {
    expect(buildTodayQueue([])).toEqual([]);
  });

  it('未学習が上限を超えていたら期限切れは1枚も出さない', () => {
    const fresh = Array.from({ length: 40 }, (_, i) => card(`f${i}`, null));
    const queue = buildTodayQueue([...fresh, card('overdue', addDaysJST(-99))]);

    expect(queue).toHaveLength(DAILY_LIMIT);
    expect(ids(queue)).not.toContain('overdue');
  });
});

describe('todayProgress', () => {
  it('今日やった件数と、その日の総仕事量を返す', () => {
    const progress = todayProgress([
      card('done1', addDaysJST(3), todayJST()),
      card('done2', addDaysJST(7), todayJST()),
      card('todo', addDaysJST(-1)),
    ]);

    expect(progress).toEqual({ done: 2, goal: 3, pct: 67 });
  });

  it('総仕事量は上限で頭打ちになる', () => {
    const cards = Array.from({ length: 100 }, (_, i) => card(`c${i}`, addDaysJST(-1)));

    expect(todayProgress(cards).goal).toBe(DAILY_LIMIT);
  });

  it('残りが上限より少ない日は、その件数が目標になる', () => {
    const progress = todayProgress([
      card('done', addDaysJST(3), todayJST()),
      card('todo', addDaysJST(-1)),
    ]);

    expect(progress.goal).toBe(2);
  });

  it('全部やり切ったら100%', () => {
    const progress = todayProgress([
      card('done1', addDaysJST(3), todayJST()),
      card('done2', addDaysJST(3), todayJST()),
    ]);

    expect(progress).toEqual({ done: 2, goal: 2, pct: 100 });
  });

  it('昨日の復習は今日の達成に数えない', () => {
    const progress = todayProgress([card('yesterday', addDaysJST(3), addDaysJST(-1))]);

    expect(progress.done).toBe(0);
  });

  it('やることが何も無い日は 0/0 で100%', () => {
    expect(todayProgress([])).toEqual({ done: 0, goal: 0, pct: 100 });
  });

  it('下書きは数に入れない', () => {
    const draft = { ...card('draft', null), meaning: '', isDraft: true };

    expect(todayProgress([draft]).goal).toBe(0);
  });
});

describe('backlogCount', () => {
  it('上限で切らずに、期限が来ている総数を返す', () => {
    const cards = Array.from({ length: 100 }, (_, i) => card(`c${i}`, addDaysJST(-1)));

    expect(backlogCount(cards)).toBe(100);
  });

  it('未来のカードは数えない', () => {
    expect(backlogCount([card('future', addDaysJST(1)), card('due', null)])).toBe(1);
  });

  it('下書きは数えない', () => {
    const draft = { ...card('draft', null), meaning: '', isDraft: true };

    expect(backlogCount([draft])).toBe(0);
  });
});

describe('masteryBreakdown', () => {
  it('段階ごとの枚数を 0〜5 の並びで返す', () => {
    const cards = [
      { ...card('a', null), mastery: 0 },
      { ...card('b', null), mastery: 0 },
      { ...card('c', null), mastery: 3 },
      { ...card('d', null), mastery: 5 },
    ];

    expect(masteryBreakdown(cards)).toEqual([2, 0, 0, 1, 0, 1]);
  });

  it('カードが無くても長さ6の配列を返す', () => {
    expect(masteryBreakdown([])).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('範囲外の習熟度は 0〜5 に丸める', () => {
    const cards = [
      { ...card('low', null), mastery: -3 },
      { ...card('high', null), mastery: 99 },
    ];

    expect(masteryBreakdown(cards)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('下書きは数えない', () => {
    const draft = { ...card('draft', null), meaning: '', isDraft: true };

    expect(masteryBreakdown([draft])).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
