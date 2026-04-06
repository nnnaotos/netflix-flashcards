'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flashcard, Show, ReviewFilter } from '@/types';
import { isDue } from '@/lib/sm2';
import FlashCard from '@/components/FlashCard';
import FilterBar from '@/components/FilterBar';
import ProgressHeader from '@/components/ProgressHeader';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilter, setShowFilter] = useState<Show>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [isShuffled, setIsShuffled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Fetch cards
  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('取得失敗');
      const data = await res.json();
      setAllCards(data.cards);
    } catch {
      setError('カードの取得に失敗しました。Notionの設定を確認してください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Apply filters
  useEffect(() => {
    let cards = [...allCards];

    if (showFilter !== 'all') {
      cards = cards.filter((c) => c.show === showFilter);
    }

    if (reviewFilter === 'unreviewed') {
      cards = cards.filter((c) => !c.latestReviewDate);
    } else if (reviewFilter === 'reviewed') {
      cards = cards.filter((c) => !!c.latestReviewDate);
    }

    if (isShuffled) cards = shuffle(cards);

    setFilteredCards(cards);
  }, [allCards, showFilter, reviewFilter, isShuffled]);

  // フィルター変更時だけindexをリセット
  useEffect(() => {
    setCurrentIndex(0);
  }, [showFilter, reviewFilter, isShuffled]);

  const handleShuffle = () => setIsShuffled((s) => !s);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleReview = async (remembered: boolean, easy = false) => {
    const card = filteredCards[currentIndex];
    if (!card) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: card.id,
          remembered,
          easy,
          currentInterval: card.interval ?? 0,
          currentEF: card.easeFactor ?? 2.5,
          currentMastery: card.mastery ?? 0,
        }),
      });

      if (!res.ok) throw new Error();
      const result = await res.json();

      // Update local state
      setAllCards((prev) =>
        prev.map((c) =>
          c.id === card.id
            ? {
                ...c,
                latestReviewDate: new Date().toISOString().split('T')[0],
                nextReviewDate: result.nextReviewDate,
                mastery: result.mastery,
                interval: result.interval,
                easeFactor: result.easeFactor,
              }
            : c
        )
      );

      showToast(remembered ? '✅ 記録しました！' : '🔄 後で再挑戦します', 'success');

      // Move to next card
      setTimeout(() => {
        if (currentIndex < filteredCards.length - 1) {
          setCurrentIndex((i) => i + 1);
        }
      }, 400);
    } catch {
      showToast('更新に失敗しました', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Computed counts
  const getCount = (rFilter: ReviewFilter) => {
    let cards = showFilter === 'all' ? allCards : allCards.filter((c) => c.show === showFilter);
    if (rFilter === 'unreviewed') return cards.filter((c) => !c.latestReviewDate).length;
    if (rFilter === 'reviewed') return cards.filter((c) => !!c.latestReviewDate).length;
    return cards.length;
  };

  const totalFiltered = filteredCards.length;
  const reviewedCount = allCards.filter((c) => !!c.latestReviewDate).length;
  const dueTodayCount = allCards.filter((c) => isDue(c.nextReviewDate)).length;

  const card = filteredCards[currentIndex];

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#141414' }}>
      {/* Header */}
      <header className="px-4 py-5 flex items-center justify-between border-b" style={{ borderColor: '#1f1f1f' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: '#E50914' }}>
            <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px', letterSpacing: '0.02em' }}>N</span>
          </div>
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', letterSpacing: '0.05em', lineHeight: 1 }}>
              NETFLIX ENGLISH
            </h1>
            <p className="text-xs text-gray-500">スペース反復学習</p>
          </div>
        </div>

        <button
          onClick={fetchCards}
          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          更新
        </button>
      </header>

      <div className="flex flex-col gap-5 py-6 flex-1">
        {/* Progress */}
        {!loading && (
          <ProgressHeader
            reviewed={reviewedCount}
            total={allCards.length}
            dueToday={dueTodayCount}
          />
        )}

        {/* Filters */}
        <FilterBar
          show={showFilter}
          reviewFilter={reviewFilter}
          onShowChange={setShowFilter}
          onReviewFilterChange={setReviewFilter}
          counts={{
            all: getCount('all'),
            unreviewed: getCount('unreviewed'),
            reviewed: getCount('reviewed'),
          }}
        />

        {/* Shuffle + nav */}
        {!loading && totalFiltered > 0 && (
          <div className="w-full max-w-2xl mx-auto px-4 flex items-center justify-between">
            <button
              onClick={handleShuffle}
              className="flex items-center gap-2 text-xs transition-colors px-3 py-1.5 rounded-lg"
              style={{
                background: isShuffled ? 'rgba(229,9,20,0.15)' : '#1f1f1f',
                border: isShuffled ? '1px solid rgba(229,9,20,0.4)' : '1px solid #2a2a2a',
                color: isShuffled ? '#E50914' : '#888',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 3 21 3 21 8"/>
                <line x1="4" y1="20" x2="21" y2="3"/>
                <polyline points="21 16 21 21 16 21"/>
                <line x1="4" y1="4" x2="9" y2="9"/>
              </svg>
              シャッフル {isShuffled ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(totalFiltered - 1, i + 1))}
                disabled={currentIndex >= totalFiltered - 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="w-full max-w-2xl mx-auto px-4">
            <div className="shimmer rounded-xl" style={{ height: '320px' }} />
            <div className="shimmer rounded-lg mt-4 h-12" />
          </div>
        ) : error ? (
          <div className="w-full max-w-2xl mx-auto px-4">
            <div className="rounded-xl p-6 text-center" style={{ background: '#1f1f1f', border: '1px solid #3a3a3a' }}>
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button onClick={fetchCards} className="text-xs text-gray-400 underline">再試行</button>
            </div>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="w-full max-w-2xl mx-auto px-4">
            <div className="rounded-xl p-10 text-center" style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}>
              <p className="text-4xl mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}>0</p>
              <p className="text-gray-400 text-sm">該当するカードがありません</p>
            </div>
          </div>
        ) : card ? (
          <FlashCard
            key={card.id}
            card={card}
            onRemembered={(easy) => handleReview(true, easy)}
            onAgain={() => handleReview(false)}
            current={currentIndex + 1}
            total={totalFiltered}
            updating={updating}
          />
        ) : null}

        {/* Completed state */}
        {!loading && totalFiltered > 0 && currentIndex >= totalFiltered && (
          <div className="w-full max-w-2xl mx-auto px-4 text-center py-10">
            <p className="text-5xl mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em', color: '#E50914' }}>
              COMPLETE!
            </p>
            <p className="text-gray-400 text-sm mb-6">全 {totalFiltered} カードを完了しました🎉</p>
            <button
              onClick={() => setCurrentIndex(0)}
              className="px-6 py-3 rounded-lg text-sm font-semibold"
              style={{ background: '#E50914', color: '#fff' }}
            >
              最初から
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl z-50 transition-all"
          style={{
            background: toast.type === 'success' ? '#1a3a1a' : '#3a1a1a',
            border: `1px solid ${toast.type === 'success' ? '#2d6a2d' : '#6a2d2d'}`,
            color: toast.type === 'success' ? '#86efac' : '#fca5a5',
          }}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}
