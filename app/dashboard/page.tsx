'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Flashcard } from '@/types';
import { backlogCount, masteryBreakdown, todayProgress } from '@/lib/deck';
import TodayTally from '@/components/TodayTally';
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
      setError('カードを読み込めませんでした。Notion の設定を確認してください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const progress = todayProgress(cards);
  const backlog = backlogCount(cards);
  const drafts = cards.filter((c) => c.isDraft).length;

  return (
    <main className="min-h-screen" style={{ background: '#141414' }}>
      <header className="w-full max-w-xl mx-auto px-5 pt-6 pb-5 flex items-baseline justify-between">
        <h1
          style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '0.06em' }}
        >
          DASHBOARD
        </h1>
        <Link
          href="/"
          className="text-[13px] text-[#8A8A8A] hover:text-white transition-colors underline underline-offset-4 decoration-[#3A3A3A] hover:decoration-white"
        >
          学習へ戻る
        </Link>
      </header>

      <div className="w-full max-w-xl mx-auto px-5 pb-16">
        {loading ? (
          <div className="flex flex-col gap-10">
            <div className="shimmer rounded h-24" />
            <div className="shimmer rounded-lg h-56" />
          </div>
        ) : error ? (
          <div className="py-10">
            <p className="text-[15px] text-[#E50914] mb-3">{error}</p>
            <button
              onClick={fetchCards}
              className="text-[13px] text-[#8A8A8A] hover:text-white transition-colors underline underline-offset-4"
            >
              もう一度読み込む
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <TodayTally done={progress.done} goal={progress.goal} />

            <p className="text-[11px] text-[#5A5A5A] mt-6 flex gap-5">
              <span>
                期限が来ているカード{' '}
                <span className="text-[#8A8A8A] tabular-nums">{backlog}</span> 枚
              </span>
              {drafts > 0 && (
                <span>
                  意味がまだ空のカード{' '}
                  <span className="text-[#8A8A8A] tabular-nums">{drafts}</span> 枚
                </span>
              )}
            </p>

            <hr className="my-9 border-0 h-px" style={{ background: '#262626' }} />

            <MasteryChart counts={masteryBreakdown(cards)} />
          </div>
        )}
      </div>
    </main>
  );
}
