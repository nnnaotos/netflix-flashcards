'use client';

import { Show, ReviewFilter } from '@/types';

interface Props {
  show: Show;
  reviewFilter: ReviewFilter;
  onShowChange: (s: Show) => void;
  onReviewFilterChange: (r: ReviewFilter) => void;
  counts: { all: number; unreviewed: number; reviewed: number };
}

const showOptions: { value: Show; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'プリズンブレイク', label: '🔒 プリズンブレイク' },
  { value: 'SUITS', label: '⚖️ SUITS' },
];

const reviewOptions: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'unreviewed', label: '未復習' },
  { value: 'reviewed', label: '復習済み' },
];

export default function FilterBar({ show, reviewFilter, onShowChange, onReviewFilterChange, counts }: Props) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 flex flex-col gap-3">
      {/* Show filter */}
      <div className="flex gap-2">
        {showOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onShowChange(opt.value)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200"
            style={{
              background: show === opt.value ? 'rgba(229,9,20,0.2)' : '#1f1f1f',
              border: show === opt.value ? '1px solid rgba(229,9,20,0.6)' : '1px solid #3a3a3a',
              color: show === opt.value ? '#E50914' : '#999',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Review filter */}
      <div className="flex gap-2">
        {reviewOptions.map((opt) => {
          const count = counts[opt.value];
          return (
            <button
              key={opt.value}
              onClick={() => onReviewFilterChange(opt.value)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: reviewFilter === opt.value ? '#2a2a2a' : '#1a1a1a',
                border: reviewFilter === opt.value ? '1px solid #4a4a4a' : '1px solid #2a2a2a',
                color: reviewFilter === opt.value ? '#fff' : '#666',
              }}
            >
              {opt.label}
              <span className="rounded-full px-1.5 py-0.5 text-xs"
                style={{
                  background: reviewFilter === opt.value ? 'rgba(229,9,20,0.3)' : '#2a2a2a',
                  color: reviewFilter === opt.value ? '#E50914' : '#555',
                }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
