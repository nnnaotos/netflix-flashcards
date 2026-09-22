import { addDaysJST, todayJST } from '@/lib/date';

/**
 * エビングハウスの忘却曲線に沿った復習スケジュール。
 * 節約率は 20分後58% / 1時間後44% / 1日後34% / 6日後25% / 1ヶ月後21% で、
 * 最初の24時間の落ち込みが一番きつい。そこで序盤を厚めにした段階表で間隔を決める。
 *
 * 段階は Notion の「習熟度」(0〜5) をそのまま使う。
 *   0=未学習 1=初級 2=初中級 3=中級 4=上級 5=マスター
 */
export const STEPS = [1, 3, 7, 14, 30, 90];

export type Answer = 'again' | 'ok' | 'easy';

export interface ReviewResult {
  step: number;
  interval: number;
  nextReviewDate: string;
}

function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(STEPS.length - 1, Math.round(step)));
}

/** 回答後の段階 */
function nextStep(currentStep: number, answer: Answer): number {
  const step = clampStep(currentStep);
  if (answer === 'again') return clampStep(step - 1);
  if (answer === 'easy') return clampStep(step + 2);
  return clampStep(step + 1);
}

/**
 * 回答後の間隔(日数)。
 * 間隔は「今いる段階」から取る。こうすると未学習(段階0)で正解したとき翌日に出るので、
 * 記事が一番重視している「最初の24時間以内の1回目」を外さへん。
 * 「完璧」は1段ぶん飛ばし、「もう一度」は段階に関わらず翌日。
 */
export function intervalFor(currentStep: number, answer: Answer): number {
  const step = clampStep(currentStep);
  if (answer === 'again') return 1;
  if (answer === 'easy') return STEPS[clampStep(step + 1)];
  return STEPS[step];
}

/** 回答から次の段階・間隔・復習日を決める */
export function nextReview(currentStep: number, answer: Answer): ReviewResult {
  const step = nextStep(currentStep, answer);
  const interval = intervalFor(currentStep, answer);

  return {
    step,
    interval,
    nextReviewDate: addDaysJST(interval),
  };
}

/** 今日が復習日を過ぎているか */
export function isDue(nextReviewDate: string | null): boolean {
  if (!nextReviewDate) return true; // 一度も復習してへんカードは常に対象
  return nextReviewDate <= todayJST();
}
