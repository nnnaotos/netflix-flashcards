'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flashcard, Show, ReviewFilter, DueFilter } from '@/types';
import { isDue, Answer } from '@/lib/schedule';
import { todayJST } from '@/lib/date';
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
  const [deckVersion, setDeckVersion] = useState(0);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dueFilter, setDueFilter] = useState<DueFilter>('due');
  const [showFilter, setShowFilter] = useState<Show>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [isShuffled, setIsShuffled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [mode, setMode] = useState<'meaningFirst' | 'phraseFirst'>('meaningFirst');

  // Fetch cards
  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('取得失敗');
      const data = await res.json();
      setAllCards(data.cards);
      setDeckVersion((v) => v + 1);
    } catch {
      setError('カードの取得に失敗しました。Notionの設定を確認してください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Apply filters (rebuild the deck only on load / filter / shuffle change).
  // allCards is intentionally not a dependency so review updates keep the current position.
  useEffect(() => {
    // 意味が空のカードは学習に使えへんので、デッキに混ぜへん
    let cards = allCards.filter((c) => !c.isDraft);

    if (dueFilter === 'due') {
      cards = cards.filter((c) => isDue(c.nextReviewDate));
    }

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
    setCurrentIndex(0);
  }, [deckVersion, dueFilter, showFilter, reviewFilter, isShuffled]);

  const handleShuffle = () => setIsShuffled((s) => !s);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleReview = async (answer: Answer) => {
    const card = filteredCards[currentIndex];
    if (!card) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 段階はサーバーがNotionから読み直すので、ここでは送らない
        body: JSON.stringify({ pageId: card.id, answer }),
      });

      if (!res.ok) throw new Error();
      const result = await res.json();

      const reviewed = (c: Flashcard) => ({
        ...c,
        latestReviewDate: todayJST(),
        nextReviewDate: result.nextReviewDate,
        mastery: result.step,
        interval: result.interval,
      });
      const applyReview = (cards: Flashcard[]) =>
        cards.map((c) => (c.id === card.id ? reviewed(c) : c));

      setAllCards(applyReview);

      if (answer === 'again') {
        // 忘れたカードはその日のうちにもう一度。デッキの末尾に回す
        setFilteredCards((prev) => [
          ...prev.filter((c) => c.id !== card.id),
          reviewed(card),
        ]);
      } else {
        setFilteredCards(applyReview);
      }

      showToast(answer === 'again' ? '🔄 あとでもう一度出します' : '✅ 記録しました！', 'success');

      // 次のカードへ。「もう一度」は今のカードが末尾へ抜けて後ろが詰まるので据え置き
      if (answer !== 'again') {
        setTimeout(() => setCurrentIndex((i) => i + 1), 400);
      }
    } catch {
      showToast('更新に失敗しました', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Computed counts. Everything below is scoped to the selected show, and the
  // review filter counts are scoped to the due filter on top of that.
  const studyCards = allCards.filter((c) => !c.isDraft);
  const draftCount = allCards.length - studyCards.length;
  const showCards = showFilter === 'all' ? studyCards : studyCards.filter((c) => c.show === showFilter);
  const dueCards = showCards.filter((c) => isDue(c.nextReviewDate));
  const scopedCards = dueFilter === 'due' ? dueCards : showCards;

  const dueCounts = { due: dueCards.length, all: showCards.length };
  const reviewCounts = {
    all: scopedCards.length,
    unreviewed: scopedCards.filter((c) => !c.latestReviewDate).length,
    reviewed: scopedCards.filter((c) => !!c.latestReviewDate).length,
  };

  const totalFiltered = filteredCards.length;
  const reviewedCount = showCards.filter((c) => !!c.latestReviewDate).length;

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
            total={showCards.length}
            dueToday={dueCounts.due}
            drafts={draftCount}
          />
        )}

        {/* Filters */}
        <FilterBar
          dueFilter={dueFilter}
          onDueFilterChange={setDueFilter}
          dueCounts={dueCounts}
          show={showFilter}
          reviewFilter={reviewFilter}
          onShowChange={setShowFilter}
          onReviewFilterChange={setReviewFilter}
          counts={reviewCounts}
        />

        {/* Mode selector */}
        {!loading && totalFiltered > 0 && (
          <div className="w-full max-w-2xl mx-auto px-4 flex items-center justify-center gap-2 mb-2">
            <button
              onClick={() => setMode('meaningFirst')}
              className="flex items-center gap-1 text-xs transition-colors px-3 py-1.5 rounded-lg"
              style={{
                background: mode === 'meaningFirst' ? 'rgba(229,9,20,0.15)' : '#1f1f1f',
                border: mode === 'meaningFirst' ? '1px solid rgba(229,9,20,0.4)' : '1px solid #2a2a2a',
                color: mode === 'meaningFirst' ? '#E50914' : '#888',
              }}
            >
              意味 → 表現
            </button>
            <button
              onClick={() => setMode('phraseFirst')}
              className="flex items-center gap-1 text-xs transition-colors px-3 py-1.5 rounded-lg"
              style={{
                background: mode === 'phraseFirst' ? 'rgba(229,9,20,0.15)' : '#1f1f1f',
                border: mode === 'phraseFirst' ? '1px solid rgba(229,9,20,0.4)' : '1px solid #2a2a2a',
                color: mode === 'phraseFirst' ? '#E50914' : '#888',
              }}
            >
              表現 → 意味
            </button>
          </div>
        )}

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
              {dueFilter === 'due' && reviewFilter === 'all' ? (
                <>
                  <p className="text-4xl mb-3">🎉</p>
                  <p className="text-gray-300 text-sm mb-1">今日の課題は終わりです</p>
                  <p className="text-gray-500 text-xs mb-6">お疲れさま。復習日が来たカードはもうありません</p>
                  <button
                    onClick={() => setDueFilter('all')}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#E50914', color: '#fff' }}
                  >
                    すべてのカードを見る
                  </button>
                </>
              ) : (
                <>
                  <p className="text-4xl mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}>0</p>
                  <p className="text-gray-400 text-sm">該当するカードがありません</p>
                </>
              )}
            </div>
          </div>
        ) : card ? (
          <FlashCard
            key={card.id}
            card={card}
            onRemembered={(easy) => handleReview(easy ? 'easy' : 'ok')}
            onAgain={() => handleReview('again')}
            current={currentIndex + 1}
            total={totalFiltered}
            updating={updating}
            mode={mode}
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
