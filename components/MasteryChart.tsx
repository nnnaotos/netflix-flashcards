'use client';

import { STEPS } from '@/lib/schedule';

/** 段階の呼び名。README の段階表と同じ並び */
const STEP_LABELS = ['未学習', '初級', '初中級', '中級', '上級', 'マスター'];

interface Props {
  /** masteryBreakdown() の戻り値。段階0〜5の枚数 */
  counts: number[];
}

/**
 * 段階ごとの枚数。
 *
 * 色は1系列ぶんだけ。どの段階かは行の位置とラベルが言うてるので、段階ごとに色を変えると
 * 同じ情報を二度持つことになる。暗い背景で単一色相の6段を作ると、一番暗い2段が背景に沈む
 * （背景比 1.5:1 まで落ちる）うえに、その2段にデッキの7割が入っとるので最悪やった。
 */
export default function MasteryChart({ counts }: Props) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[13px] text-[#8A8A8A]">次に出るまでの間隔</h2>
        <span className="text-[11px] text-[#5A5A5A] tabular-nums">{total} 枚</span>
      </div>

      <div className="rounded-lg px-4 py-4" style={{ background: '#191919' }}>
        <ol className="flex flex-col gap-3">
          {counts.map((count, step) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;

            return (
              <li key={step} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[13px] text-[#C8C8C8]">
                  {STEP_LABELS[step]}
                </span>
                <span className="w-10 shrink-0 text-[11px] text-[#5A5A5A] tabular-nums text-right">
                  {STEPS[step]}日
                </span>

                <div className="flex-1 h-[18px] rounded-[2px]" style={{ background: '#101010' }}>
                  <div
                    className="h-full rounded-[2px] transition-[width] duration-500"
                    style={{
                      width: `${(count / max) * 100}%`,
                      minWidth: count > 0 ? '3px' : 0,
                      background: '#E50914',
                    }}
                  />
                </div>

                <span
                  className="w-10 shrink-0 text-right text-[15px] text-white tabular-nums"
                  style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.02em' }}
                >
                  {count}
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] text-[#5A5A5A] tabular-nums">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
