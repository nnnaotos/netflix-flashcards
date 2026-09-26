# Netflix English Flashcards

Netflix 作品から拾った英語フレーズを、SM-2（間隔反復）で復習するためのアプリ。
カードの保存先は Notion のデータベースで、復習結果もそこに書き戻す。

Next.js 16（App Router）/ React 19 / TypeScript / Tailwind CSS 3 / `@notionhq/client`

## 必要なもの

- Node.js 20.9 以上（Vercel 側の設定は 24.x）
- テスト（`npm test`）を動かす場合は Node.js 20.19 以上。vitest が使う vite が要求する
- Notion のインテグレーションと、カード用のデータベース

## セットアップ

```bash
npm install
```

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
| `次回復習日` | 日付 | 次にこのカードを出す日 |
| `習熟度` | 数値 | 0〜5。**復習間隔の段階そのもの**（下記） |
| `Interval` | 数値 | 直近に設定した間隔（日数）。表示と履歴のため |
| `EaseFactor` | 数値 | 旧 SM-2 の名残。**今は読み書きせえへん**（過去の値は残したまま） |

`作品名` の選択肢はコード側にも書いてあるので、作品を増やすときは [types/index.ts](types/index.ts) の `Show` と
[components/FilterBar.tsx](components/FilterBar.tsx) の `showOptions` も直す。

## 構成

```
app/page.tsx          画面本体（カードの並び、フィルタ、回答の処理）
app/api/cards         GET  Notion から全カードを取得
app/api/update        POST 回答を受けて次の復習日を計算し、Notion を更新
app/api/capture       POST 拡張から届いたフレーズを下書きカードとして作成
lib/notion.ts         Notion クライアントとページ⇔カードの変換
lib/schedule.ts       復習間隔の段階表と遷移ルール、復習日の判定
components/           カード表示、フィルタ、進捗表示
```

### 下書きカード

Chrome 拡張（[extension/](extension/)）から拾ったばかりのカードは `表現` だけが埋まっていて、
`意味` が空になっている。これを下書きと呼ぶ。

下書きは出題にもカウントにも混ぜない。画面のヘッダーに件数だけ出るので、Notion 側で `意味` を
埋めると、その時点から普通のカードとして今日の課題に出てくる。

`lib/schedule.ts` の `isDue` は「一度も復習してへんカードは常に対象」を返すので、除外は
`app/page.tsx` のデッキ組み立て側でやっている。`isDue` の意味を変えると復習間隔の計算に
波及するため。

### 復習間隔

エビングハウスの忘却曲線（節約率は 20分後58% / 1時間後44% / 1日後34% / 6日後25% / 1ヶ月後21%、
推奨は 翌日 → 1週間後 → 1ヶ月後）を踏まえて、間隔は固定の段階表で決める。
段階は Notion の `習熟度` をそのまま使う。

```
段階   0      1     2      3     4     5
間隔   1日    3日   7日    14日  30日  90日
表示   未学習 初級  初中級 中級  上級  マスター
```

| 回答 | 次回 | 段階 |
|---|---|---|
| 覚えた | 今いる段階の間隔 | +1 |
| 完璧 | 1段ぶん先の間隔 | +2 |
| もう一度 | **翌日**（段階に関わらず） | −1 |

間隔を「今いる段階」から取るのは、未学習のカードで正解したときに翌日出すため。
記事が一番重視している「最初の24時間以内の1回目」をここで外さんようにしとる。
「覚えた」を押し続けると 1 → 3 → 7 → 14 → 30 → 90日 と進む。

さらに、**「もう一度」を押したカードはその日のうちにもう一度出す**（デッキの末尾に回す）。
学習直後の20分で最も急激に忘れる、という部分への対応。翌日にも出る。

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

Vercel。環境変数（`NOTION_TOKEN`・`NOTION_DATABASE_ID`・`CAPTURE_SECRET`）は Vercel 側の Settings にも設定しておく。
`CAPTURE_SECRET` を入れ忘れると、`/api/capture` は何も受け付けずに 500 を返す。

## アクセス制限について

アプリ自体はログインの仕組みを持ってへん。公開したままやと、URL を知っている人は誰でも
カードを読めるし、復習データも書き換えられる。**Vercel の Deployment Protection
（Settings → Deployment Protection）でアクセスを制限する前提**にしてある。

`/api/update` の側では、次の2つで被害を抑えてある。

- 復習の計算に使う値（Interval・EaseFactor・習熟度）は、リクエストの中身やなくて
  Notion から読み直したものを使う
- 渡されたページが、`NOTION_DATABASE_ID` のデータベースに属してへんかったら 404 を返す
  （他のページを書き換えられへんようにするため）

`/api/capture` の側は、`CAPTURE_SECRET` と一致する `x-capture-secret` ヘッダが無いと 401 を返す。
`CAPTURE_SECRET` 自体が設定されてへんときは 500 を返して何もせえへん（設定漏れのまま
無防備に公開されるのを防ぐため）。

Chrome 拡張から叩くときは Deployment Protection も通す必要があるので、Vercel の
Protection Bypass for Automation で発行した秘密を `x-vercel-protection-bypass` ヘッダに付ける。
