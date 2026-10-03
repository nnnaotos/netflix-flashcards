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
  { value: 'プリズンブレイク', label: 'プリズンブレイク' },
  { value: 'SUITS', label: 'SUITS' },
];

const reviewOptions: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'unreviewed', label: '未復習' },
  { value: 'reviewed', label: '復習済み' },
];

/** 絞り込みの2段目以降。選択中だけが明るい。枠線は常に同じ太さで、動かへん */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 py-2 px-3 rounded-md text-[12px] transition-colors duration-150 flex items-center justify-center gap-1.5 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active
          ? 'bg-[#262626] border-[#4A4A4A] text-white'
          : 'bg-transparent border-[#262626] text-[#7A7A7A] hover:text-[#B0B0B0] hover:border-[#3A3A3A]'
      }`}
    >
      {children}
    </button>
  );
}

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
    <div className="w-full max-w-2xl mx-auto px-4 flex flex-col gap-2">
      {/* 主役の切り替え。ここだけが太い字で、選択中は赤い下線が付く */}
      <div className="flex gap-6 border-b" style={{ borderColor: '#262626' }}>
        {dueOptions.map((opt) => {
          const active = dueFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onDueFilterChange(opt.value)}
              aria-pressed={active}
              className="relative pb-2.5 flex items-baseline gap-2 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ color: active ? '#FFFFFF' : '#7A7A7A' }}
            >
              <span className="text-[15px] font-semibold">{opt.label}</span>
              <span
                className="text-[12px] tabular-nums"
                style={{ color: active ? '#E50914' : '#5A5A5A' }}
              >
                {dueCounts[opt.value]}
              </span>
              {active && (
                <span
                  className="absolute left-0 right-0 -bottom-px h-[2px]"
                  style={{ background: '#E50914' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5 pt-1">
        {showOptions.map((opt) => (
          <Chip key={opt.value} active={show === opt.value} onClick={() => onShowChange(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      <div className="flex gap-1.5">
        {reviewOptions.map((opt) => (
          <Chip
            key={opt.value}
            active={reviewFilter === opt.value}
            onClick={() => onReviewFilterChange(opt.value)}
          >
            {opt.label}
            <span className="text-[11px] text-[#5A5A5A] tabular-nums">{counts[opt.value]}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}
