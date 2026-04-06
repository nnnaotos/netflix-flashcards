import { NextRequest, NextResponse } from 'next/server';
import { updateCardReview } from '@/lib/notion';
import { sm2, getQuality } from '@/lib/sm2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pageId,
      remembered,      // boolean
      easy = false,    // boolean (optional)
      currentInterval = 0,
      currentEF = 2.5,
      currentMastery = 0,
    } = body;

    if (!pageId || remembered === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const quality = getQuality(remembered, easy);
    const result = sm2(quality, currentInterval, currentEF, currentMastery);

    const today = new Date().toISOString().split('T')[0];

    await updateCardReview(
      pageId,
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
