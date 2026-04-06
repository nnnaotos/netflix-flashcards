'use client';

import { useState, useEffect } from 'react';
import { Flashcard } from '@/types';

interface Props {
  card: Flashcard;
  onRemembered: (easy?: boolean) => void;
  onAgain: () => void;
  current: number;
  total: number;
  updating: boolean;
}

const masteryColors = [
  'bg-gray-600',
  'bg-red-700',
  'bg-orange-600',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
];

const masteryLabels = ['未学習', '初級', '初中級', '中級', '上級', 'マスター'];

export default function FlashCard({ card, onRemembered, onAgain, current, total, updating }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Reset flip when card changes
  useEffect(() => {
    setFlipped(false);
    setAnimKey((k) => k + 1);
  }, [card.id]);

  const mastery = Math.min(5, Math.max(0, card.mastery ?? 0));

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto px-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between w-full text-sm text-gray-400 font-body">
        <span>
          <span className="text-white font-semibold">{current}</span> / {total}
        </span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${masteryColors[mastery]}`} />
          <span>{masteryLabels[mastery]}</span>
          {card.nextReviewDate && (
            <span className="ml-3 text-xs text-gray-500">
              次回: {card.nextReviewDate}
            </span>
          )}
        </div>
      </div>

      {/* Card */}
      <div
        key={animKey}
        className="card-scene w-full cursor-pointer select-none"
        style={{ height: '320px' }}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        aria-label={flipped ? '表に戻す' : '裏返してみる'}
      >
        <div className={`card-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="card-face bg-[#1f1f1f] border border-[#3a3a3a] shadow-2xl p-8 gap-4"
            style={{ boxShadow: '0 0 0 1px rgba(229,9,20,0.15), 0 20px 60px rgba(0,0,0,0.7)' }}>
            {/* Show badge */}
            <span className="absolute top-4 left-4 text-xs font-semibold tracking-wider uppercase px-2 py-1 rounded"
              style={{ background: 'rgba(229,9,20,0.2)', color: '#E50914', border: '1px solid rgba(229,9,20,0.3)' }}>
              {card.show}
            </span>

            {/* Flip hint */}
            <span className="absolute top-4 right-4 text-xs text-gray-600 flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              タップして確認
            </span>

            <p className="text-4xl md:text-5xl font-display text-white text-center leading-tight"
              style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}>
              {card.phrase}
            </p>
          </div>

          {/* Back */}
          <div className="card-face card-back p-8 gap-6"
            style={{
              background: 'linear-gradient(135deg, #1a0a0b 0%, #1f1f1f 100%)',
              border: '1px solid rgba(229,9,20,0.4)',
              boxShadow: '0 0 0 1px rgba(229,9,20,0.3), 0 20px 60px rgba(0,0,0,0.7)',
            }}>
            <span className="absolute top-4 left-4 text-xs font-semibold tracking-wider uppercase px-2 py-1 rounded"
              style={{ background: 'rgba(229,9,20,0.2)', color: '#E50914', border: '1px solid rgba(229,9,20,0.3)' }}>
              {card.show}
            </span>

            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-xl md:text-2xl text-gray-300 font-body font-medium leading-relaxed">
                {card.meaning}
              </p>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-red-600 to-transparent" />
              <p className="text-sm text-gray-500 font-body">{card.phrase}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className={`flex gap-4 w-full transition-all duration-300 ${flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button
          onClick={() => onAgain()}
          disabled={updating}
          className="flex-1 py-4 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-50"
          style={{
            background: '#2a2a2a',
            border: '1px solid #3a3a3a',
            color: '#fff',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3a3a3a'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#2a2a2a'; }}
        >
          <span className="flex flex-col items-center gap-1">
            <span className="text-lg">🔄</span>
            <span>もう一度</span>
            <span className="text-xs text-gray-500 font-normal">明日また出題</span>
          </span>
        </button>

        <button
          onClick={() => onRemembered(false)}
          disabled={updating}
          className="flex-1 py-4 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #E50914, #B20710)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(229,9,20,0.4)',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.9'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
        >
          <span className="flex flex-col items-center gap-1">
            <span className="text-lg">✅</span>
            <span>覚えた</span>
            <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.7)' }}>次回: {getNextLabel(card.interval)}</span>
          </span>
        </button>

        <button
          onClick={() => onRemembered(true)}
          disabled={updating}
          className="flex-1 py-4 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #1a6b2a, #145c22)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(26,107,42,0.3)',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.9'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
        >
          <span className="flex flex-col items-center gap-1">
            <span className="text-lg">⚡</span>
            <span>完璧！</span>
            <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.7)' }}>より長い間隔</span>
          </span>
        </button>
      </div>

      {updating && (
        <div className="text-xs text-gray-500 animate-pulse">Notionを更新中...</div>
      )}
    </div>
  );
}

function getNextLabel(interval: number): string {
  if (!interval || interval <= 1) return '明日';
  if (interval < 7) return `${interval}日後`;
  if (interval < 30) return `${Math.round(interval / 7)}週間後`;
  return `${Math.round(interval / 30)}ヶ月後`;
}
