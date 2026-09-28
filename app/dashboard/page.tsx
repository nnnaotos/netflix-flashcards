'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Flashcard } from '@/types';
import { backlogCount, DAILY_LIMIT, masteryBreakdown, todayProgress } from '@/lib/deck';
import MasteryChart from '@/components/MasteryChart';

export default function Dashboard() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('取得失敗');
      const data = await res.json();
      setCards(data.cards);
    } catch {
      setError('カードの取得に失敗しました。Notionの設定を確認してください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const progress = todayProgress(cards);
  const backlog = backlogCount(cards);
  const counts = masteryBreakdown(cards);
  const drafts = cards.filter((c) => c.isDraft).length;

  return (
    <main className="min-h-screen" style={{ background: '#141414' }}>
      <header
        className="px-4 py-5 flex items-center justify-between border-b"
        style={{ borderColor: '#1f1f1f' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: '#E50914' }}
          >
            <span
              style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px', letterSpacing: '0.02em' }}
            >
              N
            </span>
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: '20px',
                letterSpacing: '0.05em',
                lineHeight: 1,
              }}
            >
              DASHBOARD
            </h1>
            <p className="text-xs text-gray-500">学習の記録</p>
          </div>
        </div>

        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">
          学習へ戻る
        </Link>
      </header>

      <div className="w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {loading ? (
          <>
            <div className="shimmer rounded-xl" style={{ height: '150px' }} />
            <div className="shimmer rounded-xl" style={{ height: '320px' }} />
          </>
        ) : error ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: '#1f1f1f', border: '1px solid #3a3a3a' }}
          >
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchCards} className="text-xs text-gray-400 underline">
              再試行
            </button>
          </div>
        ) : (
          <>
            {/* 今日の達成度。数字が主役なのでグラフにはせえへん */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}
            >
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-300">今日の達成度</h2>
                <span className="text-xs text-gray-500">1日 {DAILY_LIMIT} 枚まで</span>
              </div>

              <div className="flex items-baseline gap-3 mb-4">
                <span
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: '56px',
                    lineHeight: 0.9,
                    letterSpacing: '0.02em',
                    color: progress.pct === 100 ? '#22c55e' : '#E50914',
                  }}
                >
                  {progress.done}
                </span>
                <span className="text-2xl text-gray-600" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  / {progress.goal}
                </span>
                <span
                  className="ml-auto text-3xl"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    letterSpacing: '0.02em',
                    color: progress.pct === 100 ? '#22c55e' : '#E50914',
                  }}
                >
                  {progress.pct}%
                </span>
              </div>

              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#2a2a2a' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress.pct}%`,
                    background:
                      progress.pct === 100
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : 'linear-gradient(90deg, #E50914, #ff4d57)',
                  }}
                />
              </div>

              <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-600">
                <span>
                  期限が来ているカード <span className="text-gray-400 tabular-nums">{backlog}</span> 枚
                </span>
                {drafts > 0 && (
                  <span>
                    下書き <span className="text-gray-400 tabular-nums">{drafts}</span> 枚
                  </span>
                )}
              </div>
            </div>

            <MasteryChart counts={counts} />
          </>
        )}
      </div>
    </main>
  );
}
