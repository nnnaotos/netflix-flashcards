# Netflix English Flashcards

Netflix 作品から拾った英語フレーズを、SM-2（間隔反復）で復習するためのアプリ。
カードの保存先は Notion のデータベースで、復習結果もそこに書き戻す。

Next.js 16（App Router）/ React 19 / TypeScript / Tailwind CSS 3 / `@notionhq/client`

## 必要なもの

- Node.js 20.9 以上（Vercel 側の設定は 24.x）
- Notion のインテグレーションと、カード用のデータベース

## セットアップ

```bash
npm install
```

プロジェクト直下に `.env.local` を作って、次の2つを書く。

```
NOTION_TOKEN=<Notion インテグレーションのトークン>
NOTION_DATABASE_ID=<カード用データベースの ID>
```

- トークンは https://www.notion.so/my-integrations で発行する。
- **作ったインテグレーションをデータベースに接続（共有）しておくこと。** これを忘れると、トークンが正しくてもカードを取得できへん。
- データベース ID は、データベースを開いたときの URL に含まれる32桁の文字列。

```bash
npm run dev     # 開発サーバー (http://localhost:3000)
npm run build   # 本番ビルド
npm start       # ビルド済みのものを起動
```

## Notion データベースのプロパティ

プロパティ名と型がこのとおりになってへんと、読み込みや書き込みに失敗する（[lib/notion.ts](lib/notion.ts)）。

| プロパティ名 | 型 | 用途 |
|---|---|---|
| `表現` | タイトル | カードの表面（英語フレーズ） |
| `意味` | テキスト | カードの裏面 |
| `例文` | テキスト | フレーズと一緒に表示する例文（空でもよい） |
| `作品名` | セレクト | 作品でのフィルタ用 |
| `Latest Review Date` | 日付 | 最後に復習した日 |
| `次回復習日` | 日付 | SM-2 が計算した次回の復習日 |
| `習熟度` | 数値 | 0〜5 |
| `Interval` | 数値 | SM-2 の復習間隔（日数） |
| `EaseFactor` | 数値 | SM-2 の難易度係数（初期値 2.5） |

`作品名` の選択肢はコード側にも書いてあるので、作品を増やすときは [types/index.ts](types/index.ts) の `Show` と
[components/FilterBar.tsx](components/FilterBar.tsx) の `showOptions` も直す。

## 構成

```
app/page.tsx          画面本体（カードの並び、フィルタ、回答の処理）
app/api/cards         GET  Notion から全カードを取得
app/api/update        POST 回答を受けて SM-2 で計算し、Notion を更新
lib/notion.ts         Notion クライアントとページ⇔カードの変換
lib/sm2.ts            SM-2 の計算、ボタン→quality の変換、復習日の判定
components/           カード表示、フィルタ、進捗表示
```

回答ボタンと SM-2 の quality の対応は、もう一度 = 1 / 覚えた = 4 / 完璧 = 5。

出題の向きは「意味 → 表現」と「表現 → 意味」の2種類を画面上で切り替えられる。
例文は、表現を見せる側の面に一緒に出る。

カードの絞り込みは「今日の課題（復習日が来たカード）」が主役で、起動時はこれが選ばれる。
一度も復習してへんカードも今日の課題に含まれる。作品別と未復習／復習済みは、その下で
さらに絞り込むためのもの。

### 日付の扱い

復習日の計算も「今日」の判定も、すべて日本時間（`lib/date.ts`）で行う。
サーバー（Vercel）は UTC で動くので、ここを UTC のままにすると
日本時間の 0時〜9時の間だけ日付が1日ずれる。

## デプロイ

Vercel。環境変数（`NOTION_TOKEN` と `NOTION_DATABASE_ID`）は Vercel 側の Settings にも設定しておく。

## アクセス制限について

アプリ自体はログインの仕組みを持ってへん。公開したままやと、URL を知っている人は誰でも
カードを読めるし、復習データも書き換えられる。**Vercel の Deployment Protection
（Settings → Deployment Protection）でアクセスを制限する前提**にしてある。

`/api/update` の側では、次の2つで被害を抑えてある。

- 復習の計算に使う値（Interval・EaseFactor・習熟度）は、リクエストの中身やなくて
  Notion から読み直したものを使う
- 渡されたページが、`NOTION_DATABASE_ID` のデータベースに属してへんかったら 404 を返す
  （他のページを書き換えられへんようにするため）
