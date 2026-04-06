'use client';

interface Props {
  reviewed: number;
  total: number;
  dueToday: number;
}

export default function ProgressHeader({ reviewed, total, dueToday }: Props) {
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span className="flex flex-col items-center">
              <span className="text-2xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E50914', letterSpacing: '0.02em' }}>
                {reviewed}
              </span>
              <span className="text-xs text-gray-500">復習済み</span>
            </span>
            <span className="flex flex-col items-center">
              <span className="text-2xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#fff', letterSpacing: '0.02em' }}>
                {total}
              </span>
              <span className="text-xs text-gray-500">合計</span>
            </span>
            <span className="flex flex-col items-center">
              <span className="text-2xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#f59e0b', letterSpacing: '0.02em' }}>
                {dueToday}
              </span>
              <span className="text-xs text-gray-500">今日の課題</span>
            </span>
          </div>
          <span className="text-3xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif', color: pct === 100 ? '#22c55e' : '#E50914', letterSpacing: '0.02em' }}>
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct === 100
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
