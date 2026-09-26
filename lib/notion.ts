import { Client } from '@notionhq/client';
import { Flashcard } from '@/types';

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DB_ID = process.env.NOTION_DATABASE_ID!;

function extractPlainText(richText: { plain_text?: string }[]): string {
  if (!Array.isArray(richText)) return '';
  return richText.map((t) => t.plain_text ?? '').join('');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDate(dateObj: any): string | null {
  return dateObj?.start ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pageToCard(page: any): Flashcard {
  const props = page.properties;
  const meaning = extractPlainText(props['意味']?.rich_text ?? []);

  return {
    id: page.id,
    phrase: extractPlainText(props['表現']?.title ?? []),
    meaning,
    example: props['例文']?.rich_text ? extractPlainText(props['例文']?.rich_text) : '',
    show: props['作品名']?.select?.name ?? '',
    latestReviewDate: extractDate(props['Latest Review Date']?.date),
    nextReviewDate: extractDate(props['次回復習日']?.date),
    mastery: props['習熟度']?.number ?? 0,
    interval: props['Interval']?.number ?? 0,
    isDraft: meaning.trim() === '',
  };
}

export async function fetchAllCards(): Promise<Flashcard[]> {
  const cards: Flashcard[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.databases.query({
      database_id: DB_ID,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      cards.push(pageToCard(page));
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return cards;
}

/** Notion ids come with or without dashes depending on where they were copied from */
function sameId(a: string, b: string): boolean {
  return a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();
}

/**
 * Read one card's current state straight from Notion.
 * Returns null when the page is not in the configured database, so a page id
 * from the client can never be used to write to some other page.
 */
export async function fetchCardInDatabase(pageId: string): Promise<Flashcard | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page: any = await notion.pages.retrieve({ page_id: pageId });

  if (page?.parent?.type !== 'database_id') return null;
  if (!sameId(page.parent.database_id, DB_ID)) return null;

  return pageToCard(page);
}

/** EaseFactor は使わなくなったので書き込まない（過去の値はNotionにそのまま残る） */
export async function updateCardReview(
  pageId: string,
  latestReviewDate: string,
  nextReviewDate: string,
  mastery: number,
  interval: number
) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      'Latest Review Date': {
        date: { start: latestReviewDate },
      },
      '次回復習日': {
        date: { start: nextReviewDate },
      },
      '習熟度': {
        number: mastery,
      },
      'Interval': {
        number: interval,
      },
    },
  });
}

/** 同じ表現が既にあるか。同じ字幕で2回キーを押す事故が普通に起きるので要る */
export async function findCardByPhrase(phrase: string): Promise<string | null> {
  const response = await notion.databases.query({
    database_id: DB_ID,
    filter: { property: '表現', title: { equals: phrase } },
    page_size: 1,
  });

  return response.results[0]?.id ?? null;
}

/** 拡張で拾っただけのカード。意味を空にしておくのが下書きの目印になる */
export async function createDraftCard(
  phrase: string,
  show: string | null,
  example: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    '表現': { title: [{ text: { content: phrase } }] },
    '意味': { rich_text: [] },
    '例文': { rich_text: example ? [{ text: { content: example } }] : [] },
    '習熟度': { number: 0 },
    'Interval': { number: 0 },
  };

  // 作品名が取れんかったときは、空の選択肢を作らんように触らへん
  if (show) {
    properties['作品名'] = { select: { name: show } };
  }

  const page = await notion.pages.create({
    parent: { database_id: DB_ID },
    properties,
  });

  return page.id;
}
