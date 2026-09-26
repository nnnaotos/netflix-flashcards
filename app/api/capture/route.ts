import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createDraftCard, findCardByPhrase } from '@/lib/notion';
import {
  normalizePhrase,
  normalizeExample,
  normalizeShow,
  CaptureInputError,
} from '@/lib/capture';

export const runtime = 'nodejs';

/** 長さの差は漏れるが、秘密そのものは漏れへん */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expected = process.env.CAPTURE_SECRET;

  // 設定漏れのまま無防備に公開されるより、動かへんほうがマシ
  if (!expected) {
    return NextResponse.json({ error: 'Capture is not configured' }, { status: 500 });
  }

  const provided = req.headers.get('x-capture-secret');
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let phrase: string;
  let show: string | null;
  let example: string;

  try {
    phrase = normalizePhrase(body.phrase);
    show = normalizeShow(body.show);
    example = normalizeExample(body.example);
  } catch (err) {
    if (err instanceof CaptureInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const existing = await findCardByPhrase(phrase);
    if (existing) {
      return NextResponse.json({ ok: true, pageId: existing, duplicate: true });
    }

    const pageId = await createDraftCard(phrase, show, example);
    return NextResponse.json({ ok: true, pageId, duplicate: false });
  } catch (err) {
    console.error('Notion capture error:', err);
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}
