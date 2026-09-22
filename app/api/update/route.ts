import { NextRequest, NextResponse } from 'next/server';
import { fetchCardInDatabase, updateCardReview } from '@/lib/notion';
import { nextReview, Answer } from '@/lib/schedule';
import { todayJST } from '@/lib/date';

export const runtime = 'nodejs';

const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const ANSWERS: Answer[] = ['again', 'ok', 'easy'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { pageId, answer } = body;

    if (typeof pageId !== 'string' || !PAGE_ID.test(pageId.trim())) {
      return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 });
    }
    if (!ANSWERS.includes(answer)) {
      return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
    }

    // 段階(習熟度)はNotionから読み直す。クライアントの値は古いことも改ざんされることもある
    const card = await fetchCardInDatabase(pageId.trim());
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const result = nextReview(card.mastery, answer);

    await updateCardReview(
      card.id,
      todayJST(),
      result.nextReviewDate,
      result.step,
      result.interval
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Notion update error:', err);
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}
