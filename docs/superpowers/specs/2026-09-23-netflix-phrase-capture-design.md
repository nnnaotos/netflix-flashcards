# Netflix フレーズ取り込み（PCブラウザ版）設計

2026-09-23

## 背景

カードの中身（英語フレーズ）を Notion に入れるところが手作業で、ここだけが全体のボトルネックになっている。
Netflix を観ながら気になったフレーズを、視聴を止めずに Notion へ積めるようにする。

### iPhone ネイティブアプリを見送った理由

当初はスクリーンショット + iOS ショートカットの OCR で拾う案を検討した。
iOS には「最新のスクリーンショットを取得」「画像からテキストを抽出」が標準アクションとしてあり、
背面タップから全自動で走らせられる。

ただし Netflix iOS アプリの映像は FairPlay DRM のセキュア映像パスを通るため、
スクリーンショットではその領域が黒く落ちる。Netflix の字幕は UI レイヤーではなく映像側に
描かれるので、字幕も一緒に落ちる。よって OCR する対象が残らない。

PC ブラウザ版の Chrome 拡張は、映像のピクセルではなく**字幕の DOM テキスト**を読む。
DRM の影響を受けず、OCR の誤認識もない。精度の面でも iPhone 案の上位互換になる。

> 未検証: 実機で Netflix 再生中にスクリーンショットを1枚撮れば白黒がつく。
> 万一まともに写るようであれば iPhone 案を復活させる余地はある。

## スコープ

### やること

- Chrome 拡張から現在の字幕を1キーで送る
- `POST /api/capture` が受けて Notion に「下書きカード」を作る
- 下書きカード（意味が空）は復習の出題対象から外す

### やらないこと

- AI による意味・例文の自動生成（別フェーズ）
- 下書きを編集する UI（当面 Notion 側で直接埋める）
- iPhone からの取り込み
- 拡張の Chrome ウェブストア公開（デベロッパーモードで読み込む）

## 全体構成

```
Netflix Web (Chrome)
 ├ content.js ──── 字幕DOM監視 / Alt+S / トースト
 │      │ chrome.runtime.sendMessage
 └ background.js ─ fetch + シークレット保持
        │ POST /api/capture
        ▼
 app/api/capture/route.ts ── 検証 → lib/notion.ts
        ▼
 Notion データベース ── 下書きカード（表現のみ）
```

### 責務

| 層 | 知っていること | 知らないこと |
|---|---|---|
| `content.js` | Netflix の DOM 構造 | 送信先 URL、シークレット |
| `background.js` | 送信先とシークレット | Netflix の DOM |
| `/api/capture` | 入力検証と Notion 書き込み | 拡張の存在（curl でも叩ける） |
| `lib/capture.ts` | 文字列の正規化とバリデーション | HTTP も Notion も |

### background service worker を経由する理由

1. Manifest V3 の content script からの `fetch` は Netflix の origin として扱われ、CORS の制約を受ける。
   background の `fetch` は `host_permissions` があれば素通りする。サーバ側に CORS 設定を足さずに済む。
2. シークレットが Netflix ページ内の JavaScript から読めない。content script に持たせると
   ページ側のスクリプトと同じ DOM を共有するため、露出の面で不利になる。

## `/api/capture`

### リクエスト

```
POST /api/capture
Content-Type: application/json
x-capture-secret: <CAPTURE_SECRET>
x-vercel-protection-bypass: <VERCEL_AUTOMATION_BYPASS_SECRET>   # Protection が有効なときのみ

{
  "phrase": "You're getting cold feet",
  "show": "Prison Break",
  "example": null
}
```

### レスポンス

| 状況 | ステータス | ボディ |
|---|---|---|
| 作成成功 | 200 | `{ "ok": true, "pageId": "...", "duplicate": false }` |
| 同じ表現が既にある | 200 | `{ "ok": true, "pageId": "...", "duplicate": true }` |
| 入力が不正 | 400 | `{ "error": "..." }` |
| シークレット不一致・欠落 | 401 | `{ "error": "Unauthorized" }` |
| `CAPTURE_SECRET` 未設定 | 500 | `{ "error": "Capture is not configured" }` |
| Notion 側の失敗 | 500 | `{ "error": "Failed to create card" }` |

### 認証

`CAPTURE_SECRET` 環境変数と `x-capture-secret` ヘッダを比較する。

- **`CAPTURE_SECRET` が未設定なら 500 を返して処理しない（fail-closed）。**
  設定漏れのまま無防備なエンドポイントが公開されるのを防ぐ。
- 比較はタイミング安全に行う。長さが違えば即 `false`、同じなら `crypto.timingSafeEqual`。
- `crypto` を使うので、既存の `/api/update` と同じく `export const runtime = 'nodejs'` を置く。

この認証は Vercel の Deployment Protection とは独立している。Protection は「アプリを他人に見せない」ため、
`CAPTURE_SECRET` は「エンドポイントを他人に叩かせない」ためのもので、両方を通す必要がある。

### 入力の正規化とバリデーション（`lib/capture.ts`）

純関数として切り出し、`route.ts` は薄く保つ。ここだけ単体テストを書く。

**`normalizePhrase(raw: unknown): string`**

1. 文字列でなければエラー
2. 制御文字（タブ・改行を含む）を空白に置換 — **字幕は2行に分かれて届くので必須**
3. 連続する空白を1つに畳む
4. 前後を trim
5. 空、または 200 文字超ならエラー

**`normalizeShow(raw: unknown): string | null`**

1. 未指定・空文字なら `null`
2. trim して、小文字化したものをエイリアス表で引く
3. ヒットすれば正規名、しなければ trim した元の文字列
4. 64 文字を超えるものは `null`（Notion の select を汚さない）

```ts
const SHOW_ALIASES: Record<string, string> = {
  'prison break': 'プリズンブレイク',
  'suits': 'SUITS',
};
```

Netflix の UI 言語によって英語タイトルが来るので、既存の `作品名` select に寄せる。
未知の作品はそのまま入り、Notion 側で select の選択肢が増える。増えた分は
`types/index.ts` の `Show` と `components/FilterBar.tsx` の `showOptions` に手で足す
（既存の運用と同じ）。

**`example`** は任意。指定があれば `normalizePhrase` と同じ正規化をかけ、1000 文字まで。
Phase 1 では拡張から送らない。将来「字幕全文を例文、選択範囲を表現」にするときの受け口として先に用意しておく。

### 重複の扱い

同じ字幕で 2 回キーを押す事故は普通に起きる。作成前に `表現` の完全一致で 1 件だけ問い合わせ、
あればそのページ ID を `duplicate: true` で返して**新規作成しない**。

```ts
notion.databases.query({
  database_id: DB_ID,
  filter: { property: '表現', title: { equals: phrase } },
  page_size: 1,
})
```

### Notion に書き込むプロパティ

| プロパティ | 値 |
|---|---|
| `表現` | 正規化した phrase |
| `意味` | 空（これが下書きの目印） |
| `例文` | example があれば。なければ空 |
| `作品名` | 正規化した show。`null` なら設定しない |
| `習熟度` | 0 |
| `Interval` | 0 |
| `Latest Review Date` | 設定しない |
| `次回復習日` | 設定しない |

`lib/notion.ts` に `createDraftCard()` と `findCardByPhrase()` を足す。
既存の `updateCardReview()` には触れない。

## 下書きカードを出題から外す

### 問題

`lib/schedule.ts` の `isDue(null)` は `true` を返す（一度も復習していないカードを今日の課題に含めるため）。
このままだと、意味が空の下書きが**保存した瞬間に出題される**。

### 方針

`isDue` の意味は変えない。復習間隔の計算に波及するうえ、「未復習は今日の課題」は意図された仕様である。
除外はデッキを組み立てる側の責務として扱う。

- `types/index.ts` の `Flashcard` に `isDraft: boolean` を追加
- `lib/notion.ts` の `pageToCard()` で `isDraft = meaning.trim() === ''` を計算
- `app/page.tsx` で `allCards` を `studyCards`（`!isDraft`）と `draftCards`（`isDraft`）に分け、
  デッキ構築も各種カウントも `studyCards` から行う
- ヘッダーに `下書き N件` を表示する

最後の表示は削らない。溜まっていることに気づけないと、積むだけで終わって学習に繋がらない。

## Chrome 拡張

```
extension/
  manifest.json
  content.js
  background.js
  options.html
  options.js
```

### manifest.json

- Manifest V3
- `permissions`: `storage`
- `host_permissions`: `https://www.netflix.com/*` と アプリの origin
- `content_scripts`: `https://www.netflix.com/watch/*` に `content.js`
- `background.service_worker`: `background.js`
- `options_page`: `options.html`

### content.js

**字幕の取得**

Netflix は SPA なのでプレイヤーは後から現れる。2段構えにする。

1. `document.body` を `childList` + `subtree` で軽く監視し、字幕コンテナの出現を待つ
2. 見つかったら、そのコンテナだけを `childList` + `subtree` + `characterData` で監視する

セレクタは変更に備えて複数のフォールバックを順に試す。

```js
const SUBTITLE_SELECTORS = ['.player-timedtext-text-container', '.player-timedtext'];
```

テキストはコンテナ配下の全 span の `textContent` を空白で結合する。

**直近字幕のバッファ**

人間が「今のフレーズええな」と気づいてキーを押すまでに 1〜2 秒かかる。
その間に字幕は次に変わるか消える。現在の字幕が空なら、**5 秒以内に消えた直前の字幕**を代わりに使う。
これが無いと実用に耐えない。

**キーバインド**

- デフォルトは `Alt+S`。options で変更できる
- `window.addEventListener('keydown', handler, true)` と capture フェーズで拾い、
  `stopPropagation()` して Netflix 自身のショートカットに渡さない
- `e.target` が input / textarea / contenteditable のときは無視する

**作品名の取得**

```js
const TITLE_SELECTORS = ['[data-uia="video-title"]', '.video-title'];
```

要素の `textContent` の最初の行を使う（エピソード名が続けて入ることがあるため）。
取れなければ `show` を送らない。

**トースト**

自前の `div` を挿して 2.5 秒で消す。`z-index` は最大値。

挿入先は `document.fullscreenElement ?? document.body` とする。
**Netflix はフルスクリーンで観るので、`body` 固定だとトーストが見えない。**

表示は「保存しました / 既に登録済み / 送信に失敗しました / 字幕が取得できません」の4種。

### background.js

`chrome.runtime.onMessage` で content script からの依頼を受け、`chrome.storage.local` から
エンドポイントとシークレットを読んで POST する。結果を content script に返す。

### options.html / options.js

`chrome.storage.local` に保存する項目。

| 項目 | 例 |
|---|---|
| エンドポイント URL | `https://xxx.vercel.app/api/capture` |
| キャプチャ用シークレット | `CAPTURE_SECRET` と同じ値 |
| Vercel Protection バイパストークン | 任意 |
| キーバインド | `Alt+S` |

### 配布

`chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」。
ウェブストアの審査は通さない。Windows だけで完結する。

## 環境変数

| 名前 | 置き場所 | 用途 |
|---|---|---|
| `NOTION_TOKEN` | 既存 | Notion |
| `NOTION_DATABASE_ID` | 既存 | Notion |
| `CAPTURE_SECRET` | **新規**。`.env.local` と Vercel の両方 | `/api/capture` の認証 |

## テスト

`vitest` を devDependencies に足し、`"test": "vitest run"` を package.json に追加する。

TDD で書くのは `lib/capture.ts` の純関数だけに絞る。

**`normalizePhrase`**

- 改行を含む字幕が1行に畳まれる
- 連続する空白が1つになる
- 前後の空白が落ちる
- 空文字・空白のみはエラー
- 200 文字は通り、201 文字はエラー
- 文字列以外はエラー

**`normalizeShow`**

- `'Prison Break'` / `'prison break'` がともに `'プリズンブレイク'` になる
- エイリアスに無い作品名はそのまま返る
- 未指定・空文字は `null`
- 65 文字は `null`

Notion への書き込みと Chrome 拡張の DOM 操作は手動で確認する。
モックを作り込む価値より、実物で1回確かめるほうが確度が高い。

## 実装順序

| 順 | 内容 | 完了の判定 |
|---|---|---|
| 1 | `vitest` 導入 + `lib/capture.ts`（TDD） | `npm test` が通る |
| 2 | `lib/notion.ts` 追記 + `app/api/capture/route.ts` | **curl で叩いて Notion に行が増える** |
| 3 | 下書きの出題除外 + 件数表示 | 下書きが今日の課題に出ず、ヘッダーに件数が出る |
| 4 | Chrome 拡張 | Netflix 再生中に `Alt+S` → トースト → Notion に入る |

手順 2 が通れば、3 と 4 は互いに独立して進められる。

## リスクと未検証事項

1. **Vercel の Protection Bypass for Automation。**

   公式ドキュメントで確認できたこと:
   - ヘッダ名は `x-vercel-protection-bypass`。値はプロジェクト設定で生成する秘密。
   - Hobby で使える保護方式である **Vercel Authentication をバイパスの対象に含む**
     （Password Protection は Hobby では使えない）。
   - 生成した秘密は `VERCEL_AUTOMATION_BYPASS_SECRET` としてデプロイに自動で入る。
     **秘密を再生成したら再デプロイが要る。**
   - 変更履歴に「automation testing now available on all plans」とあり、Hobby でも使える見込み。

   未確認なのは、実際にこのプロジェクトの設定画面で発行でき、curl が通るかどうか。
   手順 2 の最初に確かめる。通らない場合は Deployment Protection を無効化して
   `CAPTURE_SECRET` 一本で守る形に切り替え、README の
   「Deployment Protection で制限する前提」という記述も直す。
2. **Netflix の字幕セレクタと `data-uia` 属性は予告なく変わる。**
   複数フォールバックを持ち、取得できないときは黙らずトーストで知らせる。
3. **`Alt+S` が Netflix 側の操作と衝突する可能性。**
   capture フェーズで `stopPropagation` する。実機で他の挙動が起きないか確認する。
4. 拡張はデベロッパーモードで読み込むため、Chrome の再起動時に無効化の確認が出ることがある。

## 将来の拡張

この設計が前提として残しておくもの。

- **AI による意味・例文の生成**: `/api/capture` は下書きを作るだけなので、
  生成は別の経路（バッチ、または「受信箱」画面からの一括実行）として後から足せる。
  `isDraft` がそのまま処理対象の目印になる。
- **表現と例文の切り分け**: 字幕全文を `例文`、その中の選択範囲を `表現` にする。
  API は既に `example` を受け取れるので、拡張側の UI 追加だけで済む。
- **iPhone からの取り込み**: `/api/capture` は HTTP と JSON だけに依存しているので、
  iOS ショートカットからも同じエンドポイントを叩ける。DRM の制約が変わるか、
  音声入力で妥協できるなら、サーバ側は変更なしで繋がる。
