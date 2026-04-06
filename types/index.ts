export type Show = 'プリズンブレイク' | 'SUITS' | 'all';
export type ReviewFilter = 'all' | 'unreviewed' | 'reviewed';

export interface Flashcard {
  id: string;
  phrase: string;       // 表現 (title)
  meaning: string;      // 意味 (rich_text)
  show: string;         // 作品名 (select)
  latestReviewDate: string | null;  // Latest Review Date (date)
  nextReviewDate: string | null;    // 次回復習日 (date)
  mastery: number;                  // 習熟度 (number) 0-5
  interval: number;                 // SM-2 interval (days)
  easeFactor: number;               // SM-2 ease factor
}

export interface SM2Result {
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
  mastery: number;
}
