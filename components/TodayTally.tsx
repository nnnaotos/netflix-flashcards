'use client';

interface Props {
  done: number;
  goal: number;
}

/**
 * 今日やった枚数を、1本=1枚のタリーで出す。
 * バーの塗り割合やと「7割くらい」としか読めへんが、
 * 棒を数えられる形にすると「あと何枚」がそのまま見える。
 */
export default function TodayTally({ done, goal }: Props) {
  const complete = goal > 0 && done >= goal;
  const marks = Array.from({ length: goal }, (_, i) => i < done);

  return (
    <section>
      <h2 className="text-[13px] text-[#8A8A8A] mb-4">今日</h2>

      {goal === 0 ? (
        <p className="text-[15px] text-[#8A8A8A] py-6">
          今日ぶんの復習はありません。新しいフレーズを拾うと、ここに出てきます。
        </p>
      ) : (
        <>
          <div className="flex items-end gap-[3px] h-9" aria-hidden="true">
            {marks.map((filled, i) => (
              <div
                key={i}
                className="flex-1 rounded-[1px] transition-colors duration-300"
                style={{
                  height: filled ? '100%' : '55%',
                  background: filled ? (complete ? '#22C55E' : '#E50914') : '#262626',
                }}
              />
            ))}
          </div>

          <p className="sr-only">
            今日 {goal} 枚のうち {done} 枚が終わっています。
          </p>

          <div className="flex items-baseline gap-2 mt-5">
            <span
              style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '64px',
                lineHeight: 0.85,
                letterSpacing: '0.01em',
                color: complete ? '#22C55E' : '#FFFFFF',
              }}
              className="tabular-nums"
            >
              {done}
            </span>
            <span
              className="text-[22px] text-[#5A5A5A] tabular-nums"
              style={{ fontFamily: 'var(--font-bebas)' }}
            >
              / {goal}
            </span>
            {complete ? (
              <span className="ml-3 text-[13px] text-[#22C55E]">今日のぶんは終わりです</span>
            ) : (
              <span className="ml-3 text-[13px] text-[#8A8A8A]">あと {goal - done} 枚</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
