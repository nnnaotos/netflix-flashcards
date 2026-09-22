'use client';

import { Show, ReviewFilter, DueFilter } from '@/types';

interface Props {
  dueFilter: DueFilter;
  onDueFilterChange: (d: DueFilter) => void;
  dueCounts: { due: number; all: number };
  show: Show;
  reviewFilter: ReviewFilter;
  onShowChange: (s: Show) => void;
  onReviewFilterChange: (r: ReviewFilter) => void;
  counts: { all: number; unreviewed: number; reviewed: number };
}

const dueOptions: { value: DueFilter; label: string }[] = [
  { value: 'due', label: '今日の課題' },
  { value: 'all', label: 'すべてのカード' },
];

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

export default function FilterBar({
  dueFilter,
  onDueFilterChange,
  dueCounts,
  show,
  reviewFilter,
  onShowChange,
  onReviewFilterChange,
  counts,
}: Props) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 flex flex-col gap-3">
      {/* Due filter — the main way to study, so it leads */}
      <div className="flex gap-2">
        {dueOptions.map((opt) => {
          const active = dueFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onDueFilterChange(opt.value)}
              className="flex-1 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: active
                  ? 'linear-gradient(135deg, rgba(229,9,20,0.3), rgba(229,9,20,0.12))'
                  : '#191919',
                border: active ? '1px solid rgba(229,9,20,0.7)' : '1px solid #2a2a2a',
                color: active ? '#fff' : '#777',
                boxShadow: active ? '0 4px 20px rgba(229,9,20,0.25)' : 'none',
              }}
            >
              {opt.label}
              <span className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: active ? '#E50914' : '#2a2a2a',
                  color: active ? '#fff' : '#555',
                }}>
                {dueCounts[opt.value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Show filter */}
      <div className="flex gap-2">
        {showOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onShowChange(opt.value)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200"
            style={{
              background: show === opt.value ? '#2a2a2a' : '#1a1a1a',
              border: show === opt.value ? '1px solid #4a4a4a' : '1px solid #2a2a2a',
              color: show === opt.value ? '#fff' : '#666',
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
