/**
 * 日付はすべて日本時間で扱う。
 * サーバー(Vercel)はUTCで動くので、端末のタイムゾーンに任せると
 * 日本の 0時〜9時の間だけ日付が1日ずれる。
 */
const TZ = 'Asia/Tokyo';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 日本時間の今日 (YYYY-MM-DD) */
export function todayJST(): string {
  return formatter.format(new Date());
}

/** 日本時間の今日から days 日後 (YYYY-MM-DD) */
export function addDaysJST(days: number): string {
  const [y, m, d] = todayJST().split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}
