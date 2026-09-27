/** Netflix から拾った文字列を Notion に入れられる形に整える。HTTP も Notion も知らない純関数 */

/**
 * Netflix の UI 言語によって英語タイトルが来るので、既存の「作品名」select に寄せる。
 * 日本語UIは邦題を併記した形（`SUITS/スーツ`）で返してくるので、そっちも要る。
 * 実機で拾った文字列をそのまま足すこと。推測で足すと、どのみち当たらへん。
 */
const SHOW_ALIASES: Record<string, string> = {
  'prison break': 'プリズンブレイク',
  suits: 'SUITS',
  'suits/スーツ': 'SUITS',
};

const MAX_PHRASE = 200;
const MAX_EXAMPLE = 1000;
const MAX_SHOW = 64;

export class CaptureInputError extends Error {}

/** 字幕は2行に分かれて届くので、改行を空白に均してから1行に畳む */
function collapse(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizePhrase(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new CaptureInputError('phrase must be a string');
  }

  const phrase = collapse(raw);

  if (!phrase) {
    throw new CaptureInputError('phrase must not be empty');
  }
  if (phrase.length > MAX_PHRASE) {
    throw new CaptureInputError(`phrase must be ${MAX_PHRASE} characters or fewer`);
  }

  return phrase;
}

export function normalizeExample(raw: unknown): string {
  if (raw === undefined || raw === null) return '';

  if (typeof raw !== 'string') {
    throw new CaptureInputError('example must be a string');
  }

  const example = collapse(raw);

  if (example.length > MAX_EXAMPLE) {
    throw new CaptureInputError(`example must be ${MAX_EXAMPLE} characters or fewer`);
  }

  return example;
}

/** 作品名は無くても保存できたほうがええので、投げずに null を返す */
export function normalizeShow(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const show = collapse(raw);

  if (!show) return null;
  // 長すぎるものを通すと Notion の select の選択肢が汚れる
  if (show.length > MAX_SHOW) return null;

  return SHOW_ALIASES[show.toLowerCase()] ?? show;
}
