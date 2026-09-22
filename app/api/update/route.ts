import { NextRequest, NextResponse } from 'next/server';
import { fetchCardInDatabase, updateCardReview } from '@/lib/notion';
import { sm2, getQuality } from '@/lib/sm2';
import { todayJST } from '@/lib/date';

export const runtime = 'nodejs';

const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { pageId, remembered, easy = false } = body;

    if (typeof pageId !== 'string' || !PAGE_ID.test(pageId.trim())) {
      return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 });
    }
    if (typeof remembered !== 'boolean' || typeof easy !== 'boolean') {
      return NextResponse.json({ error: 'Invalid fields' }, { status: 400 });
    }

    // The SM-2 state comes from Notion, never from the client: the client's
    // copy can be stale (another device) or tampered with.
    const card = await fetchCardInDatabase(pageId.trim());
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const quality = getQuality(remembered, easy);
    const result = sm2(quality, card.interval, card.easeFactor, card.mastery);

    const today = todayJST();

    await updateCardReview(
      card.id,
      today,
      result.nextReviewDate,
      result.mastery,
      result.interval,
      result.easeFactor
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Notion update error:', err);
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}
