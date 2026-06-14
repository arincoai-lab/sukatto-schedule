# スカッと予定 — 話す/撮るだけで予定が入る入力特化PWA

複数のスケジュールアプリ併用と毎日の手入力の煩雑さを解消するための、入力に特化したスマホ向けPWA。
**話す・撮る・打つ → 1タップ確認 → Googleカレンダーへ登録**。

- **ほぼクライアント完結**: 有料API無し・秘密鍵無し。唯一のサーバー要素はICS取得用の極小プロキシ1本のみ
- **オープン/無料のAIのみ**: 解析は端末内（WebGPUのWebLLM）＋ルールベース（chrono）、OCRはTesseract.js
- 同期方針(A案): 書き込みはGoogleカレンダーをハブに。OutlookやTimeTree等はICS購読URLで統合閲覧（読み取り専用）。

## 入力と解析の経路（ハイブリッド）

各エンジンの強みで使い分ける（`src/parse/index.ts`）:

| 入力 | 一次経路 | フォールバック |
|---|---|---|
| 打つ / 話す（短文） | ルール解析(chrono, 高速・相対日付に強い) | 弱い時のみ端末内LLM |
| 撮る（写真OCR, 雑多・複数予定） | 端末内LLM(複数抽出に強い) | ルール解析 |

> 端末内LLM(WebLLM)は **WebGPU** 必須・初回はモデルDL(約1GB)。
> WebGPU非対応端末でもルール解析だけで「明日15時 歯医者」級は確実に登録できる。

## 技術スタック

React + TypeScript + Vite / vite-plugin-pwa / chrono-node / @mlc-ai/web-llm / tesseract.js /
Google Identity Services + Calendar REST API v3

## セットアップ

```bash
npm install
npm run dev   # http://localhost:5173 （スマホ実機は同一LANの http://<PCのIP>:5173 ）
```

### Google カレンダー連携の準備（ユーザー側）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成 → **Google Calendar API** を有効化
2. OAuth 同意画面を設定（テストユーザに自分を追加）
3. 認証情報 → **OAuth クライアントID（ウェブアプリ）** を作成
   - 承認済みの JavaScript 生成元に `http://localhost:5173`（および本番URL）を追加
4. 発行された **クライアントID**（`xxxxx.apps.googleusercontent.com`、公開値・秘密鍵ではない）を
   アプリの「設定」に入力 → 「接続する」

## 構成

```
src/
  input/      VoiceCapture(音声) / PhotoCapture(写真) / QuickAdd(手動)
  parse/      index(ファサード) / rule-parser(chrono) / llm-parser(WebLLM) / ocr(Tesseract)
  confirm/    EventConfirm(確認・修正UI)
  calendar/   google-auth(GIS) / google-events(insert/list) / AgendaView
  store/      settings(localStorage)
  util/       datetime(表示整形)
  App.tsx     画面オーケストレーション
```

## ビルド / 検証

```bash
npm run typecheck   # 型チェック
npm run build       # 本番ビルド（PWA: app shellのみプリキャッシュ、AI系は遅延DL）
```

## 外部カレンダーの統合閲覧（ICS購読）

「設定 → 統合閲覧する外部カレンダー」に公開ICS(.ics / webcal://)URLを追加すると、
Googleの予定と同じアジェンダに読み取り専用で統合表示される。

- CORS回避のため取得は極小プロキシ経由（`/api/ics`）。dev は Vite ミドルウェア、本番は Vercel Function（`api/ics.ts`、共通ロジックは `server/ics-proxy.ts`）。プロキシはSSRFガード・サイズ上限・タイムアウト付きで秘密情報を扱わない。
- **Outlook**: 予定表の「公開」→ ICS(.ics)リンクを取得して登録。
- **Google**: 設定 → カレンダー → 「カレンダーの統合」→ 「iCal形式の限定公開URL」を登録（テストに便利）。
- **TimeTree**: 公式にICS/iCalエクスポート非対応のため統合閲覧不可。代替として、TimeTree側でGoogleカレンダーへ予定を反映する運用なら、そのGoogleカレンダー経由で閲覧できる。
- 解析は `ical.js`。繰り返し予定は表示期間（約5週間）内で展開。

## よく使う予定テンプレ

「設定 → よく使う予定テンプレ」で「出勤」「ジム」等を登録すると、ホームの「クイック登録」チップから
**1タップ＋日付選択だけ**で確認画面へ。毎日の入力を最短化する（初回は出勤/ジム/休みのサンプル入り、編集・削除可）。

## 予定の編集・削除と通知

- **編集・削除**: アジェンダのGoogle予定をタップ → 内容を編集して「更新」、または「削除」。ICS購読の予定は読み取り専用（「閲覧のみ」表示）。
- **通知（リマインダー）**: 予定をGoogleに書き込む際に「○分前にポップアップ」を設定（既定は設定パネルで指定、予定ごとに変更可）。通知自体は**Googleカレンダーが全端末で発火**するため、バックエンドレスでも確実。

## ロードマップ

- **Phase 2（完了）**: ICS購読でOutlook・TimeTree等を統合閲覧
- **Phase 3（完了）**: よく使う予定テンプレ／写真OCR精度強化（前処理・認識テキスト編集ステップ・複数行→複数予定）／予定の編集・削除／通知（Googleリマインダー）
- **次の候補**: 週/月ビュー、予定の検索、本番デプロイ自動化
- **TimeTree**: ICS非対応のため直接連携は不可。必要ならTimeTree→Google同期運用での間接閲覧を検討。
