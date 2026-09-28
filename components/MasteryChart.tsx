'use client';

import { STEPS } from '@/lib/schedule';

/** 段階の呼び名。README の段階表と同じ並び */
const STEP_LABELS = ['未学習', '初級', '初中級', '中級', '上級', 'マスター'];

interface Props {
  /** masteryBreakdown() の戻り値。段階0〜5の枚数 */
  counts: number[];
}

/**
 * 段階ごとの枚数。色は1系列ぶんだけ使う。
 * どの段階かは行の位置とラベルが言うてるので、段階ごとに色を変えると同じ情報を二度持つことになる。
 */
export default function MasteryChart({ counts }: Props) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);

  return (
    <div className="rounded-xl p-5" style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-300">習熟度の分布</h2>
        <span className="text-xs text-gray-500">{total} 枚</span>
      </div>

      <div className="flex flex-col gap-3">
        {counts.map((count, step) => {
          const pct = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={step} className="group flex items-center gap-3">
              <div className="w-20 shrink-0 text-right">
                <div className="text-xs text-gray-300 group-hover:text-white transition-colors">
                  {STEP_LABELS[step]}
                </div>
                <div className="text-[10px] text-gray-600">{STEPS[step]}日</div>
              </div>

              {/* バーの軌道。長さは最大値を基準にする */}
              <div className="flex-1 h-5 rounded" style={{ background: '#161616' }}>
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${(count / max) * 100}%`,
                    minWidth: count > 0 ? '4px' : 0,
                    background: '#E50914',
                  }}
                />
              </div>

              <div className="w-20 shrink-0 flex items-baseline gap-1.5">
                <span
                  className="text-sm text-white tabular-nums"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.03em' }}
                >
                  {count}
                </span>
                <span className="text-[10px] text-gray-500 tabular-nums">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-600 mt-5 leading-relaxed">
        「覚えた」を押すと1段ずつ、「完璧」なら2段先へ進む。「もう一度」で1段戻る。
        右の日数は、その段階に居るカードを次に出すまでの間隔。
      </p>
    </div>
  );
}
