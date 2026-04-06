import { Client } from '@notionhq/client';
import { Flashcard } from '@/types';

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DB_ID = process.env.NOTION_DATABASE_ID!;

function extractPlainText(richText: unknown[]): string {
  if (!Array.isArray(richText)) return '';
  return richText.map((t) => (t as { plain_text?: string }).plain_text ?? '').join('');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDate(dateObj: any): string | null {
  return dateObj?.start ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pageToCard(page: any): Flashcard {
  const props = page.properties;

  return {
    id: page.id,
    phrase: extractPlainText(props['表現']?.title ?? []),
    meaning: extractPlainText(props['意味']?.rich_text ?? []),
    show: props['作品名']?.select?.name ?? '',
    latestReviewDate: extractDate(props['Latest Review Date']?.date),
    nextReviewDate: extractDate(props['次回復習日']?.date),
    mastery: props['習熟度']?.number ?? 0,
    interval: props['Interval']?.number ?? 0,
    easeFactor: props['EaseFactor']?.number ?? 2.5,
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

export async function updateCardReview(
  pageId: string,
  latestReviewDate: string,
  nextReviewDate: string,
  mastery: number,
  interval: number,
  easeFactor: number
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
      'EaseFactor': {
        number: easeFactor,
      },
    },
  });
}
