# Netflix フレーズ取り込み 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Netflix Web を観ながら `Alt+S` の1打で、現在の字幕を Notion に下書きカードとして積めるようにする。

**Architecture:** Chrome 拡張の content script が Netflix の字幕 DOM を監視し、background service worker 経由で `POST /api/capture` に送る。API は入力を正規化して Notion に「意味が空のカード」を作る。意味が空のカードは下書きとみなし、復習の出題から外す。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / `@notionhq/client` v2 / vitest / Chrome Extension Manifest V3

**Spec:** [docs/superpowers/specs/2026-09-23-netflix-phrase-capture-design.md](../specs/2026-09-23-netflix-phrase-capture-design.md)

## Global Constraints

- Node.js 20.9 以上（Vercel 側は 24.x）
- Notion のプロパティ名は日本語のまま使う: `表現` / `意味` / `例文` / `作品名` / `習熟度` / `Interval` / `Latest Review Date` / `次回復習日`
- **`lib/schedule.ts` / `app/api/update/route.ts` / `lib/date.ts` は変更しない**
- `CAPTURE_SECRET` 未設定時は fail-closed。500 を返して処理しない
- 文字数上限: `phrase` 200 / `example` 1000 / `show` 64
- 直近字幕のバッファは 5000ms
- Chrome 拡張は Manifest V3。ウェブストアには出さない
- コメントは既存コードに合わせて日本語・最小限。「何を」ではなく「なぜ」を書く
- コミットメッセージは末尾に `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` を付ける

---

### Task 1: 入力正規化の純関数と vitest

**Files:**
- Create: `lib/capture.ts`
- Create: `lib/capture.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: なし
- Produces:
  - `class CaptureInputError extends Error`
  - `normalizePhrase(raw: unknown): string` — 不正なら `CaptureInputError` を投げる
  - `normalizeExample(raw: unknown): string` — 未指定なら `''`、不正なら `CaptureInputError`
  - `normalizeShow(raw: unknown): string | null` — 不正・長すぎは投げずに `null`

- [ ] **Step 1: vitest を入れる**

```bash
npm install -D vitest
```

- [ ] **Step 2: `package.json` に test スクリプトを足す**

`scripts` を次の形にする。

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
```

- [ ] **Step 3: `vitest.config.ts` を作る**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: 失敗するテストを書く**

`lib/capture.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizePhrase,
  normalizeExample,
  normalizeShow,
  CaptureInputError,
} from './capture';

describe('normalizePhrase', () => {
  it('字幕の改行を空白に畳む', () => {
    expect(normalizePhrase("You're getting\ncold feet")).toBe("You're getting cold feet");
  });

  it('連続する空白を1つにする', () => {
    expect(normalizePhrase('cold    feet')).toBe('cold feet');
  });

  it('前後の空白を落とす', () => {
    expect(normalizePhrase('  cold feet  ')).toBe('cold feet');
  });

  it('空白だけならエラー', () => {
    expect(() => normalizePhrase('   ')).toThrow(CaptureInputError);
  });

  it('200文字は通る', () => {
    const s = 'a'.repeat(200);
    expect(normalizePhrase(s)).toBe(s);
  });

  it('201文字はエラー', () => {
    expect(() => normalizePhrase('a'.repeat(201))).toThrow(CaptureInputError);
  });

  it('文字列以外はエラー', () => {
    expect(() => normalizePhrase(42)).toThrow(CaptureInputError);
    expect(() => normalizePhrase(undefined)).toThrow(CaptureInputError);
  });
});

describe('normalizeExample', () => {
  it('未指定は空文字', () => {
    expect(normalizeExample(undefined)).toBe('');
    expect(normalizeExample(null)).toBe('');
  });

  it('改行を畳む', () => {
    expect(normalizeExample('one\ntwo')).toBe('one two');
  });

  it('1000文字は通り、1001文字はエラー', () => {
    expect(normalizeExample('a'.repeat(1000))).toHaveLength(1000);
    expect(() => normalizeExample('a'.repeat(1001))).toThrow(CaptureInputError);
  });

  it('文字列以外はエラー', () => {
    expect(() => normalizeExample(42)).toThrow(CaptureInputError);
  });
});

describe('normalizeShow', () => {
  it('英語タイトルを既存の作品名に寄せる', () => {
    expect(normalizeShow('Prison Break')).toBe('プリズンブレイク');
  });

  it('大文字小文字を問わない', () => {
    expect(normalizeShow('prison break')).toBe('プリズンブレイク');
    expect(normalizeShow('SUITS')).toBe('SUITS');
    expect(normalizeShow('suits')).toBe('SUITS');
  });

  it('エイリアスにない作品名はそのまま返す', () => {
    expect(normalizeShow('Breaking Bad')).toBe('Breaking Bad');
  });

  it('未指定・空はnull', () => {
    expect(normalizeShow(undefined)).toBeNull();
    expect(normalizeShow('')).toBeNull();
    expect(normalizeShow('   ')).toBeNull();
  });

  it('64文字は通り、65文字はnull', () => {
    expect(normalizeShow('a'.repeat(64))).toHaveLength(64);
    expect(normalizeShow('a'.repeat(65))).toBeNull();
  });

  it('文字列以外はnull', () => {
    expect(normalizeShow(42)).toBeNull();
  });
});
```

- [ ] **Step 5: テストが落ちるのを確認する**

Run: `npm test`
Expected: FAIL。`Failed to resolve import "./capture"` が出る。

- [ ] **Step 6: 最小の実装を書く**

`lib/capture.ts`

```ts
/** Netflix から拾った文字列を Notion に入れられる形に整える。HTTP も Notion も知らない純関数 */

/** Netflix の UI 言語によって英語タイトルが来るので、既存の「作品名」select に寄せる */
const SHOW_ALIASES: Record<string, string> = {
  'prison break': 'プリズンブレイク',
  suits: 'SUITS',
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
```

- [ ] **Step 7: テストが通るのを確認する**

Run: `npm test`
Expected: PASS。`normalizePhrase` 7件 / `normalizeExample` 4件 / `normalizeShow` 6件 の計 17 件。

- [ ] **Step 8: ビルドが壊れてへんことを確認する**

Run: `npm run build`
Expected: 成功。テストファイルと vitest.config.ts が型エラーを出さないこと。

- [ ] **Step 9: コミット**

```bash
git add package.json package-lock.json vitest.config.ts lib/capture.ts lib/capture.test.ts
git commit -F- <<'EOF'
Normalize captured phrases before they reach Notion

Subtitles arrive split across two lines, so a phrase taken straight
from the DOM carries a newline into the title property. Fold control
characters to spaces and collapse runs of whitespace before anything
else looks at the text.

Show names come through in whatever language the Netflix UI is set to,
so map the English titles onto the select options already in the
database. An unknown show passes through as-is rather than being
dropped -- a new select option is easier to fix up than a lost card.

This is the first test in the project, so vitest comes with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Notion 側の下書き読み書き

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/notion.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `Flashcard.isDraft: boolean` — `意味` が空のカード
  - `findCardByPhrase(phrase: string): Promise<string | null>` — 見つかればページ ID
  - `createDraftCard(phrase: string, show: string | null, example: string): Promise<string>` — 作ったページ ID

- [ ] **Step 1: `types/index.ts` に `isDraft` を足す**

`Flashcard` の末尾に1行追加する。

```ts
export interface Flashcard {
  id: string;
  phrase: string;       // 表現 (title)
  meaning: string;      // 意味 (rich_text)
  example: string;      // 例文 (text)
  show: string;         // 作品名 (select)
  latestReviewDate: string | null;  // Latest Review Date (date)
  nextReviewDate: string | null;    // 次回復習日 (date)
  mastery: number;                  // 習熟度 (number) 0-5 = 復習間隔の段階
  interval: number;                 // Interval (days) 直近に設定した間隔
  isDraft: boolean;                 // 意味が空 = 拡張で拾っただけで、まだ学習に使えへん
}
```

- [ ] **Step 2: `pageToCard` で `isDraft` を計算する**

`lib/notion.ts:21-35` の `pageToCard` を次の形に差し替える。`意味` を2回読まんように変数に取る。

```ts
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
```

- [ ] **Step 3: 重複チェックと下書き作成を足す**

`lib/notion.ts` の末尾に追記する。

```ts
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
```

`Latest Review Date` と `次回復習日` は設定しない。未設定のままにしておく。

- [ ] **Step 4: 型が通るのを確認する**

Run: `npm run build`
Expected: 成功。`app/page.tsx` 側で `isDraft` が無いというエラーは出えへん（`Flashcard` を作っとるのは `pageToCard` だけなので）。

- [ ] **Step 5: 既存のテストが壊れてへんことを確認する**

Run: `npm test`
Expected: PASS。Task 1 の 17 件がそのまま通る。

- [ ] **Step 6: コミット**

```bash
git add types/index.ts lib/notion.ts
git commit -F- <<'EOF'
Read and write draft cards in Notion

A card captured from Netflix has a phrase and nothing else, so an empty
meaning is what marks it as a draft. pageToCard derives isDraft from
that rather than adding a property to the database, which keeps the
Notion schema unchanged.

createDraftCard leaves both date properties unset and skips the show
property entirely when no title was read, so an empty select option is
never created.

findCardByPhrase exists because pressing the key twice on the same
subtitle is a normal accident, not an edge case.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: `/api/capture`

**Files:**
- Create: `app/api/capture/route.ts`
- Modify: `README.md`
- Modify: `.env.local`（コミットしない）

**Interfaces:**
- Consumes: `normalizePhrase` / `normalizeExample` / `normalizeShow` / `CaptureInputError`（Task 1）、`findCardByPhrase` / `createDraftCard`（Task 2）
- Produces: `POST /api/capture`。ヘッダ `x-capture-secret`、ボディ `{ phrase, show?, example? }`、成功時 `{ ok: true, pageId: string, duplicate: boolean }`

- [ ] **Step 1: `.env.local` に `CAPTURE_SECRET` を足す**

秘密は自分で作る。

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

出た値を `.env.local` に追記する。

```
CAPTURE_SECRET=<上で出た64文字>
```

- [ ] **Step 2: ルートを書く**

`app/api/capture/route.ts`

```ts
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
```

- [ ] **Step 3: ローカルで動かして確認する**

別のターミナルで `npm run dev` を起動しておく。以下は Git Bash で流す。`<SECRET>` は Step 1 の値。

```bash
# 401 になること
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/capture \
  -H 'Content-Type: application/json' \
  -d '{"phrase":"test"}'

# 400 になること（phrase が空）
curl -s -X POST http://localhost:3000/api/capture \
  -H 'Content-Type: application/json' -H 'x-capture-secret: <SECRET>' \
  -d '{"phrase":"   "}'

# 200 / duplicate:false になること
curl -s -X POST http://localhost:3000/api/capture \
  -H 'Content-Type: application/json' -H 'x-capture-secret: <SECRET>' \
  -d '{"phrase":"You'"'"'re getting\ncold feet","show":"Prison Break"}'

# もう一度同じものを送って duplicate:true になること
curl -s -X POST http://localhost:3000/api/capture \
  -H 'Content-Type: application/json' -H 'x-capture-secret: <SECRET>' \
  -d '{"phrase":"You'"'"'re getting cold feet","show":"Prison Break"}'
```

Expected:
- 1つ目: `401`
- 2つ目: `{"error":"phrase must not be empty"}`
- 3つ目: `{"ok":true,"pageId":"...","duplicate":false}`
- 4つ目: `{"ok":true,"pageId":"<3つ目と同じID>","duplicate":true}`

**Notion のデータベースを開いて、`表現` が `You're getting cold feet`（改行なし1行）、`作品名` が `プリズンブレイク`、`意味` が空のページが1件だけ増えとることを目で確かめる。**

- [ ] **Step 4: Vercel 側の設定と、本番での疎通を確認する**

ここが計画中いちばんの不確実点。**先に潰す。**

1. Vercel の Settings → Environment Variables に `CAPTURE_SECRET` を足す（Production）
2. Settings → Deployment Protection → Protection Bypass for Automation で秘密を発行する
3. **再デプロイする**（`VERCEL_AUTOMATION_BYPASS_SECRET` はビルド時に焼き込まれるので、発行しただけでは効かへん）
4. 疎通を確かめる

```bash
curl -s -X POST https://<your-app>.vercel.app/api/capture \
  -H 'Content-Type: application/json' \
  -H 'x-capture-secret: <CAPTURE_SECRET>' \
  -H 'x-vercel-protection-bypass: <発行した秘密>' \
  -d '{"phrase":"bypass check","show":"SUITS"}'
```

Expected: `{"ok":true,...}`。Notion に `bypass check` が増える。

**通らへんかった場合**（Protection Bypass が使えない等）:
- Deployment Protection を無効化し、`CAPTURE_SECRET` 一本で守る形に切り替える
- README の「アクセス制限について」の節を、その事実に合わせて書き直す
- 切り替えたことを報告してから次のタスクへ進む

確認できたテスト用のページは Notion から消しておく。

- [ ] **Step 5: README に `CAPTURE_SECRET` を足す**

「セットアップ」の環境変数の説明を次の形に直す。

````markdown
プロジェクト直下に `.env.local` を作って、次の3つを書く。

```
NOTION_TOKEN=<Notion インテグレーションのトークン>
NOTION_DATABASE_ID=<カード用データベースの ID>
CAPTURE_SECRET=<自分で決めた長い文字列>
```

- トークンは https://www.notion.so/my-integrations で発行する。
- **作ったインテグレーションをデータベースに接続（共有）しておくこと。** これを忘れると、トークンが正しくてもカードを取得できへん。
- データベース ID は、データベースを開いたときの URL に含まれる32桁の文字列。
- `CAPTURE_SECRET` は Chrome 拡張から `/api/capture` を叩くときの合言葉。
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` あたりで作る。
  **設定してへんと `/api/capture` は 500 を返して何も受け付けへん。**
````

「構成」のファイル一覧に1行足す。

```
app/api/capture       POST 拡張から届いたフレーズを下書きカードとして作成
```

- [ ] **Step 6: コミット**

`.env.local` は `.gitignore` に入っとるはずやけど、`git status` で混ざってへんことを確かめてから。

```bash
git status --short
git add app/api/capture/route.ts README.md
git commit -F- <<'EOF'
Accept captured phrases at /api/capture

The extension needs somewhere to post to, and it cannot hold the Notion
token, so this endpoint holds it instead.

Authentication is a shared secret in a header, checked with a constant
time comparison. When CAPTURE_SECRET is missing the route returns 500
rather than running: a deploy that forgot the variable should stop
working, not sit open.

A repeat of a phrase already in the database returns the existing page
id with duplicate: true instead of creating a second card.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: 下書きを出題から外す

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/ProgressHeader.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `Flashcard.isDraft`（Task 2）
- Produces: なし（画面の挙動が変わるだけ）

`lib/schedule.ts` は触らない。`isDue` は「未復習は今日の課題」という意図された仕様なので、そこを変えると復習間隔の計算に波及する。除外はデッキを組む側の責務にする。

- [ ] **Step 1: `ProgressHeader` に下書き件数を足す**

`components/ProgressHeader.tsx` の `Props` と、3つ並んどる数字の後ろに1つ足す。

```tsx
interface Props {
  reviewed: number;
  total: number;
  dueToday: number;
  drafts: number;
}

export default function ProgressHeader({ reviewed, total, dueToday, drafts }: Props) {
```

`今日の課題` の `</span>` の直後、`</div>` の前に足す。0件のときは出さない。

```tsx
            {drafts > 0 && (
              <span className="flex flex-col items-center">
                <span className="text-2xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#60a5fa', letterSpacing: '0.02em' }}>
                  {drafts}
                </span>
                <span className="text-xs text-gray-500">下書き</span>
              </span>
            )}
```

- [ ] **Step 2: デッキの組み立てから下書きを外す**

`app/page.tsx:57` の1行を差し替える。

変更前:
```tsx
    let cards = [...allCards];
```

変更後:
```tsx
    // 意味が空のカードは学習に使えへんので、デッキに混ぜへん
    let cards = allCards.filter((c) => !c.isDraft);
```

- [ ] **Step 3: カウントからも下書きを外す**

`app/page.tsx:139` の `showCards` を、下書きを抜いたものから作るように差し替える。

変更前:
```tsx
  const showCards = showFilter === 'all' ? allCards : allCards.filter((c) => c.show === showFilter);
```

変更後:
```tsx
  const studyCards = allCards.filter((c) => !c.isDraft);
  const draftCount = allCards.length - studyCards.length;
  const showCards = showFilter === 'all' ? studyCards : studyCards.filter((c) => c.show === showFilter);
```

- [ ] **Step 4: `ProgressHeader` に渡す**

`app/page.tsx:187-191` を差し替える。

```tsx
          <ProgressHeader
            reviewed={reviewedCount}
            total={showCards.length}
            dueToday={dueCounts.due}
            drafts={draftCount}
          />
```

- [ ] **Step 5: 動かして確かめる**

`npm run dev` を起動。Task 3 で作ったテスト用ページを消してもうてたら、もう一度 curl で1件作る。

```bash
curl -s -X POST http://localhost:3000/api/capture \
  -H 'Content-Type: application/json' -H 'x-capture-secret: <SECRET>' \
  -d '{"phrase":"draft filter check","show":"SUITS"}'
```

http://localhost:3000 を開いて「更新」を押し、次を目で確かめる。

- ヘッダーに `下書き 1` が青字で出とる
- 「今日の課題」に `draft filter check` が出てこない
- 「すべて」に切り替えても出てこない
- 「合計」の数に含まれてへん

そのあと Notion で `draft filter check` の `意味` に何か書いて、画面で「更新」を押す。

- `下書き` の表示が消える
- `draft filter check` が今日の課題に出てくる

確認できたら Notion からテスト用ページを消す。

- [ ] **Step 6: ビルドとテスト**

Run: `npm run build && npm test`
Expected: どちらも成功。

- [ ] **Step 7: README に下書きの扱いを書く**

「### 復習間隔」の節の直前に、次の節を足す。

```markdown
### 下書きカード

Chrome 拡張（[extension/](extension/)）から拾ったばかりのカードは `表現` だけが埋まっていて、
`意味` が空になっている。これを下書きと呼ぶ。

下書きは出題にもカウントにも混ぜない。画面のヘッダーに件数だけ出るので、Notion 側で `意味` を
埋めると、その時点から普通のカードとして今日の課題に出てくる。

`lib/schedule.ts` の `isDue` は「一度も復習してへんカードは常に対象」を返すので、除外は
`app/page.tsx` のデッキ組み立て側でやっている。`isDue` の意味を変えると復習間隔の計算に
波及するため。
```

- [ ] **Step 8: コミット**

```bash
git add app/page.tsx components/ProgressHeader.tsx README.md
git commit -F- <<'EOF'
Keep draft cards out of the deck

isDue returns true for a card that has never been reviewed, which is
deliberate -- new cards should come up today. But a draft has no
meaning on the back, so that same rule would serve it for review the
moment the extension saved it.

Filter drafts out where the deck is built instead of changing isDue,
which the interval calculation also depends on. The header shows how
many are waiting, because a pile you cannot see is a pile you never
fill in.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: 拡張の骨組み（manifest / background / options）

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background.js`
- Create: `extension/options.html`
- Create: `extension/options.js`

**Interfaces:**
- Consumes: `POST /api/capture`（Task 3）
- Produces:
  - `chrome.storage.local` のキー: `endpoint` / `secret` / `bypass` / `hotkey`
  - background が受けるメッセージ: `{ type: 'capture', payload: { phrase: string, show?: string } }`
  - background が返す値: `{ ok: true, duplicate: boolean }` または `{ ok: false, error: string }`

このタスクの時点では content script はまだ無い。options 画面の「テスト送信」ボタンで疎通を確かめる。

- [ ] **Step 1: `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Netflix Phrase Capture",
  "version": "0.1.0",
  "description": "Netflix の字幕からフレーズを拾って Notion に送る",
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://*.vercel.app/*",
    "http://localhost:3000/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "options_page": "options.html"
}
```

`content_scripts` は Task 6 で足す。

- [ ] **Step 2: `extension/background.js`**

```js
/**
 * content script からの依頼を受けて /api/capture に投げる。
 * シークレットをここに閉じ込めることで、Netflix ページ内の JS から読めへんようにしとる。
 * MV3 の content script からの fetch は Netflix の origin 扱いで CORS に引っかかるが、
 * background からなら host_permissions で素通りする。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'capture') return false;

  send(message.payload).then(sendResponse);
  return true; // 非同期で返すので true
});

async function send(payload) {
  const { endpoint, secret, bypass } = await chrome.storage.local.get([
    'endpoint',
    'secret',
    'bypass',
  ]);

  if (!endpoint || !secret) {
    return { ok: false, error: '拡張の設定が未入力です' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-capture-secret': secret,
  };

  // Vercel の Deployment Protection を通すため。ローカルや保護なしなら空でよい
  if (bypass) {
    headers['x-vercel-protection-bypass'] = bypass;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `送信に失敗しました (${res.status})` };
    }

    const data = await res.json();
    return { ok: true, duplicate: !!data.duplicate };
  } catch {
    return { ok: false, error: '送信に失敗しました' };
  }
}
```

- [ ] **Step 3: `extension/options.html`**

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>Netflix Phrase Capture の設定</title>
    <style>
      body {
        font: 14px/1.6 system-ui, sans-serif;
        max-width: 560px;
        margin: 32px auto;
        padding: 0 16px;
      }
      label { display: block; margin-top: 16px; font-weight: 600; }
      input { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; }
      .hint { font-weight: 400; color: #666; font-size: 12px; }
      .row { margin-top: 24px; display: flex; gap: 8px; align-items: center; }
      button { padding: 8px 16px; cursor: pointer; }
      #status { margin-left: 8px; }
    </style>
  </head>
  <body>
    <h1>Netflix Phrase Capture</h1>

    <label>
      エンドポイント URL
      <span class="hint">例: https://xxx.vercel.app/api/capture</span>
      <input id="endpoint" type="url" placeholder="https://xxx.vercel.app/api/capture" />
    </label>

    <label>
      キャプチャ用シークレット
      <span class="hint">アプリの CAPTURE_SECRET と同じ値</span>
      <input id="secret" type="password" />
    </label>

    <label>
      Vercel Protection バイパストークン
      <span class="hint">任意。Deployment Protection を使ってへんなら空でよい</span>
      <input id="bypass" type="password" />
    </label>

    <label>
      ホットキー
      <span class="hint">例: Alt+S / Ctrl+Shift+S</span>
      <input id="hotkey" type="text" placeholder="Alt+S" />
    </label>

    <div class="row">
      <button id="save">保存</button>
      <button id="test">テスト送信</button>
      <span id="status"></span>
    </div>

    <script src="options.js"></script>
  </body>
</html>
```

- [ ] **Step 4: `extension/options.js`**

```js
const FIELDS = ['endpoint', 'secret', 'bypass', 'hotkey'];

const status = document.getElementById('status');

function say(message) {
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 4000);
}

chrome.storage.local.get(FIELDS).then((saved) => {
  for (const key of FIELDS) {
    document.getElementById(key).value = saved[key] ?? '';
  }
  if (!saved.hotkey) document.getElementById('hotkey').value = 'Alt+S';
});

document.getElementById('save').addEventListener('click', async () => {
  const values = {};
  for (const key of FIELDS) {
    values[key] = document.getElementById(key).value.trim();
  }
  values.hotkey = values.hotkey || 'Alt+S';

  await chrome.storage.local.set(values);
  say('保存しました');
});

document.getElementById('test').addEventListener('click', async () => {
  say('送信中…');

  const res = await chrome.runtime.sendMessage({
    type: 'capture',
    payload: { phrase: 'extension test', show: 'SUITS' },
  });

  if (!res?.ok) {
    say(res?.error ?? '送信に失敗しました');
  } else {
    say(res.duplicate ? '既に登録済み（疎通OK）' : '送信できました');
  }
});
```

- [ ] **Step 5: 読み込んで疎通を確かめる**

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ `extension/` を選ぶ
4. 「詳細」→「拡張機能のオプション」で設定画面を開く
5. エンドポイントとシークレットを入れて「保存」
6. 「テスト送信」を押す

Expected: `送信できました` と出て、Notion に `extension test` が増える。もう一度押すと `既に登録済み（疎通OK）`。

**エラーが出たら**、`chrome://extensions` の「Service Worker」リンクから DevTools を開いてコンソールを見る。

確認できたら Notion からテスト用ページを消す。

- [ ] **Step 6: コミット**

```bash
git add extension/manifest.json extension/background.js extension/options.html extension/options.js
git commit -F- <<'EOF'
Add the extension shell that talks to /api/capture

The service worker owns the endpoint and the secret. A content script
shares a DOM with whatever Netflix runs on the page, so the secret
stays out of it; the worker also sidesteps CORS, since a fetch from a
content script carries Netflix's origin while host_permissions covers
the worker's.

The options page has a test button so the round trip to Notion can be
verified before any subtitle reading exists.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: 字幕の取得とホットキー

**Files:**
- Create: `extension/content.js`
- Modify: `extension/manifest.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: background のメッセージ `{ type: 'capture', payload: { phrase, show? } }`（Task 5）
- Produces: なし（これが最後）

- [ ] **Step 1: `extension/manifest.json` に content script を足す**

`"background"` の後ろに足す。

```json
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/watch/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
```

- [ ] **Step 2: `extension/content.js`**

```js
(() => {
  const SUBTITLE_ROOT = '.player-timedtext';
  const SUBTITLE_LINE = '.player-timedtext-text-container';
  const TITLE_SELECTORS = ['[data-uia="video-title"]', '.video-title'];

  // 「今のフレーズええな」と気づいてキーを押すまで1〜2秒かかる。その間に字幕は消える
  const RECENT_MS = 5000;

  let current = '';
  let recent = '';
  let recentAt = 0;

  let observer = null;
  let observedRoot = null;
  let hotkey = { alt: true, ctrl: false, shift: false, key: 's' };

  // --- 字幕の読み取り ---

  function readSubtitle() {
    const root = document.querySelector(SUBTITLE_ROOT);
    if (!root) return '';

    // 1行につき1つの container が並ぶ。入れ子の span を舐めると重複するのでこっちを見る
    const lines = root.querySelectorAll(SUBTITLE_LINE);
    const parts = lines.length
      ? Array.from(lines).map((el) => el.textContent ?? '')
      : [root.textContent ?? ''];

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function update() {
    const text = readSubtitle();

    if (text) {
      current = text;
      recent = text;
      recentAt = Date.now();
    } else {
      current = '';
    }
  }

  function track() {
    const root = document.querySelector(SUBTITLE_ROOT);
    if (!root) return false;

    observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    observedRoot = root;
    update();

    return true;
  }

  /** エピソードを移ると字幕コンテナごと作り直される。見とる先が消えてたら付け直す */
  function reattachIfDetached() {
    if (observedRoot && document.contains(observedRoot)) return;

    if (observer) observer.disconnect();
    observer = null;
    observedRoot = null;
    track();
  }

  function phraseToSend() {
    if (current) return current;
    if (recent && Date.now() - recentAt < RECENT_MS) return recent;
    return '';
  }

  function readTitle() {
    for (const selector of TITLE_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;

      // シリーズ名・話数・エピソード名が子要素に分かれとるので、先頭＝シリーズ名を取る
      const head = el.firstElementChild ?? el;
      const text = (head.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return '';
  }

  // --- トースト ---

  let toastEl = null;
  let toastTimer = null;

  const TOAST_COLORS = { success: '#1a3a1a', error: '#3a1a1a', info: '#26262e' };

  function toast(message, kind) {
    // Netflix はフルスクリーンで観るので、body に挿すと見えへん
    const host = document.fullscreenElement ?? document.body;

    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = [
        'position:fixed',
        'top:24px',
        'left:50%',
        'transform:translateX(-50%)',
        'padding:10px 18px',
        'border-radius:10px',
        'z-index:2147483647',
        'font:600 14px/1.4 system-ui,sans-serif',
        'color:#fff',
        'pointer-events:none',
        'max-width:70vw',
        'transition:opacity .3s',
      ].join(';');
    }

    if (toastEl.parentNode !== host) host.appendChild(toastEl);

    toastEl.style.background = TOAST_COLORS[kind] ?? TOAST_COLORS.info;
    toastEl.textContent = message;
    toastEl.style.opacity = '1';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = '0';
    }, 2500);
  }

  // --- 送信 ---

  async function capture() {
    reattachIfDetached();

    const phrase = phraseToSend();
    if (!phrase) {
      toast('字幕が取得できません', 'error');
      return;
    }

    toast('送信中…', 'info');

    const show = readTitle();
    const res = await chrome.runtime.sendMessage({
      type: 'capture',
      payload: show ? { phrase, show } : { phrase },
    });

    if (!res?.ok) {
      toast(res?.error ?? '送信に失敗しました', 'error');
    } else if (res.duplicate) {
      toast('既に登録済み', 'info');
    } else {
      toast(`保存しました: ${phrase.slice(0, 40)}`, 'success');
    }
  }

  // --- ホットキー ---

  function parseHotkey(value) {
    const parts = String(value || 'Alt+S')
      .split('+')
      .map((p) => p.trim().toLowerCase());

    return {
      alt: parts.includes('alt'),
      ctrl: parts.includes('ctrl') || parts.includes('control'),
      shift: parts.includes('shift'),
      key: parts[parts.length - 1],
    };
  }

  function isTyping(target) {
    if (!(target instanceof HTMLElement)) return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  }

  chrome.storage.local.get('hotkey').then(({ hotkey: value }) => {
    hotkey = parseHotkey(value);
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (isTyping(e.target)) return;
      if (e.key.toLowerCase() !== hotkey.key) return;
      if (e.altKey !== hotkey.alt) return;
      if (e.ctrlKey !== hotkey.ctrl) return;
      if (e.shiftKey !== hotkey.shift) return;

      // Netflix 自身のショートカットに渡さへん
      e.preventDefault();
      e.stopPropagation();

      capture();
    },
    true // capture フェーズで先に拾う
  );

  // --- 起動 ---

  // Netflix は SPA なのでプレイヤーは後から現れる。出てくるまで body を軽く見張る
  if (!track()) {
    const boot = new MutationObserver(() => {
      if (track()) boot.disconnect();
    });
    boot.observe(document.body, { childList: true, subtree: true });
  }
})();
```

- [ ] **Step 3: 実機で確かめる**

1. `chrome://extensions` で拡張の「更新」（リロード）を押す
2. Netflix で作品を再生し、**英語字幕をON**にする
3. 字幕が出ている状態で `Alt+S`

Expected: 画面上部に `保存しました: ...` と出て、Notion に `表現` だけのページが増える。`作品名` が入っとる。

順に確かめる。

- [ ] 字幕が出てる最中に押す → 保存できる
- [ ] 字幕が消えた直後（5秒以内）に押す → 直前の字幕が保存される
- [ ] **フルスクリーンにして押す → トーストが見える**
- [ ] 同じ字幕でもう一度押す → `既に登録済み`
- [ ] `Alt+S` を押しても Netflix 側が勝手に動かへん（再生/停止やシークが起きない）
- [ ] 2行の字幕が Notion で1行になっとる
- [ ] 次のエピソードに移ってからもう一度押す → 保存できる（再アタッチが効いとる）

**字幕が取得できません が出る場合**: DevTools のコンソールで `document.querySelector('.player-timedtext')` を評価する。`null` なら Netflix 側で DOM が変わっとるので、実際のセレクタを調べて `SUBTITLE_ROOT` / `SUBTITLE_LINE` を直す。

確認できたら、テストで作ったページを Notion から整理する。

- [ ] **Step 4: README に拡張の節を足す**

「## デプロイ」の直前に足す。

````markdown
## Chrome 拡張（フレーズの取り込み）

Netflix Web を観ながら、字幕を1キーで下書きカードとして Notion に送るための拡張。
[extension/](extension/) に入っている。ウェブストアには出していない。

### 入れ方

1. Chrome で `chrome://extensions` を開き、「デベロッパーモード」をON
2. 「パッケージ化されていない拡張機能を読み込む」で `extension/` を選ぶ
3. 「拡張機能のオプション」で次を設定して保存

| 項目 | 値 |
|---|---|
| エンドポイント URL | `https://<アプリ>/api/capture` |
| キャプチャ用シークレット | `.env.local` の `CAPTURE_SECRET` と同じ値 |
| Vercel Protection バイパストークン | Vercel の Protection Bypass for Automation で発行した秘密。使ってへんなら空 |
| ホットキー | 既定は `Alt+S` |

「テスト送信」で疎通を確かめられる。

### 使い方

Netflix で再生中、気になる字幕が出たら `Alt+S`。再生は止まらない。
字幕が消えた後でも5秒以内なら直前の字幕が送られる。気づいてキーを押すまでの間があるため。

`作品名` は再生画面のタイトルから拾う。Netflix の UI 言語によって英語で来るので、
`lib/capture.ts` の `SHOW_ALIASES` で既存の選択肢に寄せている。増やすときはここに足す。

### 動かへんとき

- トーストが出ない → `chrome://extensions` で拡張をリロードする
- `字幕が取得できません` → Netflix 側の DOM が変わった可能性がある。
  DevTools で `document.querySelector('.player-timedtext')` を見て、
  `extension/content.js` の `SUBTITLE_ROOT` / `SUBTITLE_LINE` を直す
- `送信に失敗しました (401)` → シークレットが合ってへん
- `送信に失敗しました (500)` → アプリ側に `CAPTURE_SECRET` が設定されてへん
````

- [ ] **Step 5: 最終確認**

Run: `npm run build && npm test`
Expected: どちらも成功。

- [ ] **Step 6: コミット**

```bash
git add extension/content.js extension/manifest.json README.md
git commit -F- <<'EOF'
Capture the current subtitle with a hotkey

Watching the subtitle container and sending whatever is on screen is
not enough on its own: noticing a phrase and reaching for the key takes
a second or two, by which point the subtitle has changed. Keep the last
one for five seconds and fall back to it.

The toast goes into the fullscreen element when there is one. Netflix
is watched fullscreen, and a toast appended to body is invisible there,
which would leave no way to tell a save from a silent failure.

Keydown is handled in the capture phase and stopped, so the key never
reaches Netflix's own shortcuts. Episode changes rebuild the subtitle
container, so a detached observer is reattached before each capture.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## 完了の条件

- `npm test` が通る（`lib/capture.ts` の17件）
- `npm run build` が通る
- Netflix 再生中に `Alt+S` → Notion に `表現` と `作品名` だけのページが増える
- その下書きがアプリの「今日の課題」に出てこない
- Notion で `意味` を埋めると今日の課題に出てくる
- README だけ読んで、拡張を別の PC に入れ直せる
