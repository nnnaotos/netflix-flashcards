'use client';

import { useState, useEffect } from 'react';
import { Flashcard } from '@/types';
import { intervalFor, STEPS } from '@/lib/schedule';

interface Props {
  card: Flashcard;
  onRemembered: (easy?: boolean) => void;
  onAgain: () => void;
  current: number;
  total: number;
  updating: boolean;
  mode: 'meaningFirst' | 'phraseFirst';
}

const masteryLabels = ['未学習', '初級', '初中級', '中級', '上級', 'マスター'];

/**
 * 段階を色相やなく本数で示す。
 * 虹色（灰→赤→橙→黄→黄緑→緑）やと、赤と緑が隣り合う型の色覚では見分けがつかへんし、
 * そもそも6段階に6色を割り当てる理由がない。位置で読める。
 */
function MasteryMeter({ step }: { step: number }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className="w-[7px] h-[3px] rounded-[1px]"
          style={{ background: i <= step ? '#E50914' : '#303030' }}
        />
      ))}
    </span>
  );
}

export default function FlashCard({
  card,
  onRemembered,
  onAgain,
  current,
  total,
  updating,
  mode,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Reset flip when card changes
  useEffect(() => {
    setFlipped(false);
    setAnimKey((k) => k + 1);
  }, [card.id]);

  const mastery = Math.min(5, Math.max(0, card.mastery ?? 0));
  const isMeaningFirst = mode === 'meaningFirst';
  // 押したらどうなるかの予告。/api/update と同じ計算
  const okInterval = intervalFor(card.mastery, 'ok');
  const easyInterval = intervalFor(card.mastery, 'easy');

  const phrase = (
    <p
      className="text-4xl md:text-5xl text-white text-center leading-tight"
      style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.02em' }}
    >
      {card.phrase}
    </p>
  );

  const example = card.example ? (
    <>
      <span className="w-10 h-px" style={{ background: '#3A3A3A' }} />
      <p className="text-[13px] text-[#8A8A8A] leading-relaxed text-center max-w-sm">
        {card.example}
      </p>
    </>
  ) : null;

  const meaning = (
    <p className="text-xl md:text-2xl text-[#D4D4D4] leading-relaxed text-center">{card.meaning}</p>
  );

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto px-4">
      {/* 進行状況。カードの上に置いて、めくる前から見えるようにする */}
      <div className="flex items-center justify-between w-full text-[13px] text-[#8A8A8A]">
        <span className="tabular-nums">
          <span className="text-white">{current}</span> / {total}
        </span>
        <div className="flex items-center gap-2.5">
          <MasteryMeter step={mastery} />
          <span>{masteryLabels[mastery]}</span>
          <span className="text-[11px] text-[#5A5A5A] tabular-nums">{STEPS[mastery]}日</span>
        </div>
      </div>

      {/* Card */}
      <div
        key={animKey}
        className="card-scene w-full cursor-pointer select-none"
        style={{ height: '320px' }}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        aria-label={flipped ? '表に戻す' : '裏返して答えを見る'}
      >
        <div className={`card-inner ${flipped ? 'flipped' : ''}`}>
          {/* 表 */}
          <div
            className="card-face p-8 gap-4"
            style={{ background: '#1C1C1C', border: '1px solid #2E2E2E' }}
          >
            <span className="absolute top-4 left-5 text-[11px] text-[#8A8A8A]">{card.show}</span>
            <span className="absolute top-4 right-5 text-[11px] text-[#5A5A5A]">
              タップして答えを見る
            </span>

            <div className="flex flex-col items-center justify-center h-full gap-4">
              {isMeaningFirst ? meaning : (
                <>
                  {phrase}
                  {example}
                </>
              )}
            </div>
          </div>

          {/* 裏。表との違いは面の色やなく、左端の赤い帯で示す */}
          <div
            className="card-face card-back p-8 gap-6 overflow-hidden"
            style={{ background: '#1C1C1C', border: '1px solid #2E2E2E' }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: '#E50914' }}
            />
            <span className="absolute top-4 left-5 text-[11px] text-[#8A8A8A]">{card.show}</span>

            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              {isMeaningFirst ? (
                <>
                  {phrase}
                  {example}
                </>
              ) : (
                meaning
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 答え。3つは1つの色族の濃淡で、押す頻度の順に強くする */}
      <div
        className={`flex gap-2.5 w-full transition-opacity duration-200 ${
          flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <AnswerButton
          onClick={onAgain}
          disabled={updating}
          label="もう一度"
          sub="明日また出す"
          variant="quiet"
        />
        <AnswerButton
          onClick={() => onRemembered(false)}
          disabled={updating}
          label="覚えた"
          sub={nextLabel(okInterval)}
          variant="primary"
        />
        <AnswerButton
          onClick={() => onRemembered(true)}
          disabled={updating}
          label="完璧"
          sub={nextLabel(easyInterval)}
          variant="outline"
        />
      </div>

      <div className="h-4 text-[11px] text-[#5A5A5A]">
        {updating && 'Notion に記録しています'}
      </div>
    </div>
  );
}

type Variant = 'quiet' | 'primary' | 'outline';

const VARIANTS: Record<Variant, string> = {
  quiet:
    'bg-[#1C1C1C] border border-[#333333] text-[#E8E8E8] hover:bg-[#262626] hover:border-[#4A4A4A]',
  primary: 'bg-[#E50914] border border-[#E50914] text-white hover:bg-[#F6121D]',
  outline:
    'bg-transparent border border-[#E50914] text-[#FF6B73] hover:bg-[rgba(229,9,20,0.12)]',
};

function AnswerButton({
  onClick,
  disabled,
  label,
  sub,
  variant,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  sub: string;
  variant: Variant;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-3.5 rounded-lg transition-colors duration-150 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${VARIANTS[variant]}`}
    >
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="text-[11px] font-normal opacity-70">{sub}</span>
      </span>
    </button>
  );
}

function nextLabel(interval: number): string {
  if (!interval || interval <= 1) return '明日';
  if (interval < 7) return `${interval}日後`;
  if (interval < 30) return `${Math.round(interval / 7)}週間後`;
  return `${Math.round(interval / 30)}ヶ月後`;
}
