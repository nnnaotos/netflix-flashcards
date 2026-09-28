'use client';

import Link from 'next/link';

interface Props {
  /** 今日すでに復習した枚数 */
  done: number;
  /** 今日ぶんの目標 */
  goal: number;
  /** done / goal (%) */
  pct: number;
  /** 学習カードの総数（下書きを除く） */
  total: number;
  /** 下書きの枚数。0 のときは出さへん */
  drafts: number;
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="flex flex-col items-center">
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ fontFamily: 'Bebas Neue, sans-serif', color, letterSpacing: '0.02em' }}
      >
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </span>
  );
}

export default function ProgressHeader({ done, goal, pct, total, drafts }: Props) {
  const complete = pct === 100;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <Stat value={done} label="今日やった" color={complete ? '#22c55e' : '#E50914'} />
            <Stat value={goal} label="今日の目標" color="#f59e0b" />
            <Stat value={total} label="合計" color="#fff" />
            {drafts > 0 && <Stat value={drafts} label="下書き" color="#60a5fa" />}
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className="text-3xl font-bold tabular-nums"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                color: complete ? '#22c55e' : '#E50914',
                letterSpacing: '0.02em',
              }}
            >
              {pct}%
            </span>
            <Link
              href="/dashboard"
              className="text-[11px] text-gray-500 hover:text-white transition-colors"
            >
              ダッシュボード
            </Link>
          </div>
        </div>

        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: complete
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : 'linear-gradient(90deg, #E50914, #ff4d57)',
              boxShadow: '0 0 8px rgba(229,9,20,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
