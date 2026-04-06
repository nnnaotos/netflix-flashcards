import { NextResponse } from 'next/server';
import { fetchAllCards } from '@/lib/notion';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  try {
    const cards = await fetchAllCards();
    return NextResponse.json({ cards });
  } catch (err) {
    console.error('Notion fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}
