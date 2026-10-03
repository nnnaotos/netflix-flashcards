'use client';

import Link from 'next/link';

interface Props {
  /** 今日すでに復習した枚数 */
  done: number;
  /** 今日ぶんの目標 */
  goal: number;
  /** done / goal (%) */
  pct: number;
  /** 下書きの枚数。0 のときは出さへん */
  drafts: number;
}

/**
 * 学習画面の進捗。
 * 詳しい内訳はダッシュボードにあるので、ここは「今日あと何枚か」だけを静かに出す。
 */
export default function ProgressHeader({ done, goal, pct, drafts }: Props) {
  const complete = goal > 0 && done >= goal;
  const accent = complete ? '#22C55E' : '#E50914';

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[13px] text-[#8A8A8A]">今日</span>
          <span className="text-[15px] tabular-nums" style={{ color: accent }}>
            {done}
            <span className="text-[#5A5A5A]"> / {goal}</span>
          </span>
          {complete && <span className="text-[12px] text-[#22C55E]">終わりです</span>}
        </div>

        <Link
          href="/dashboard"
          className="text-[12px] text-[#7A7A7A] hover:text-white transition-colors underline underline-offset-4 decoration-[#3A3A3A] hover:decoration-white"
        >
          ダッシュボード
        </Link>
      </div>

      <div className="h-[3px] rounded-[1px] overflow-hidden" style={{ background: '#262626' }}>
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>

      {drafts > 0 && (
        <p className="text-[11px] text-[#5A5A5A] mt-2 tabular-nums">
          意味がまだ空のカード {drafts} 枚
        </p>
      )}
    </div>
  );
}
