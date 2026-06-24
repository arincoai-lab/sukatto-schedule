# スカッと予定 — ローンチ進捗 & 次にやること

> このファイルは作業のハンドオフ。次回はここを見れば続きから始められる。最終更新: 2026-06-24

## 主要URL / プロジェクト
- **LP**: https://sukatto.rt-ai-lab.com （Vercelプロジェクト `sukatto-schedule-grin` / root Next.js）
- **アプリ**: https://app.sukatto.rt-ai-lab.com （Vercelプロジェクト `sukatto-schedule-oeyl` / `schedule/` Vite）
- リポジトリ: `arincoai-lab/sukatto-schedule`（モノレポ。root=`apps/`、LP=`app/`、アプリ=`schedule/`）
- DNS: ConoHa（GMO）でCNAME管理
- 計測: Vercel Web Analytics（各プロジェクトの Analytics タブ）

## ✅ 完了済み（本番反映済み）
- コード: 入力特化UX（入力を下部集約・カレンダー上・接続中チップ・クイック登録横スクロール）、テンプレ編集＋作成/登録時の開始/終了調整、モーダルの下付けボトムシート、買い切りPro土台、LP、プライバシー/利用規約（Google Limited Use込み）
- ドメイン: LP・アプリともサブドメイン割当・SSL有効
- Google OAuth: **本番公開（In production）** ＝誰でも利用可（審査前は「未確認」警告＋〜100人枠）。スコープ=`https://www.googleapis.com/auth/calendar`
- Web Analytics: LP・アプリ両方で稼働（PV＋カスタムイベント）

## ⏳ 次にやること（優先順）

### 1.（最優先・長期）OAuth審査で「未確認」警告と100人枠を外す
警告はソフトローンチの転換を下げるので早めに。前提（LP/privacy/terms/独自ドメイン）は満たし済み。
- **やること**: デモ動画を撮る → Google Cloud Console の OAuth同意画面 →「確認のため送信」→ 下記の正当化文＋動画リンクを提出
- **デモ動画の中身**（YouTube限定公開でOK・15〜30秒〜数分）:
  1. `sukatto.rt-ai-lab.com`（LP）→「使ってみる」でアプリへ
  2. 「Googleに接続」→ **同意画面（カレンダー権限が映る状態）** → 許可
  3. 「明日15時 歯医者」と話す/打つ → 確認 → 登録
  4. **Googleカレンダーを開いて予定が入っているのを見せる**（書き込みの実証）＋アジェンダ表示（読み取りの実証）
  - ※ 同意画面とスコープがハッキリ映ること＋実際にカレンダー反映される様子が審査のキモ。マーケのキラーデモと兼用できる。
- **スコープ正当化（審査フォームにコピペ・英語推奨）**:
  ```
  Sukatto Schedule (スカッと予定) is a free, input-focused scheduling PWA. Users add
  calendar events by speaking, photographing a paper schedule, or typing a short phrase;
  the app parses the date, time and title on the user's device and writes the event to
  the user's Google Calendar.

  We request https://www.googleapis.com/auth/calendar because the app:
  - reads the user's calendar list so they can choose which calendar(s) to write to;
  - reads upcoming events to show an agenda/month view alongside newly added events;
  - creates, edits and deletes the events the user chooses to register.

  All speech/photo/text parsing runs on-device. We do not store calendar data on our
  servers, do not use it for advertising, and do not share it with third parties, in
  compliance with the Google API Services User Data Policy including the Limited Use
  requirements.
  Homepage: https://sukatto.rt-ai-lab.com
  Privacy:  https://sukatto.rt-ai-lab.com/privacy
  ```

### 2.（方針上あとで＝検証して売れる確証が出てから）Gumroad で買い切りProを有効化
- Gumroad で商品作成（応援価格 ¥500〜1,500・**ライセンスキー発行ON**）
- Vercel `sukatto-schedule-oeyl` の Environment Variables:
  - `GUMROAD_PRODUCT_ID` = Gumroad商品のproduct_id
  - `VITE_PRO_PURCHASE_URL` = Gumroad商品ページURL
- 動作確認: アプリ設定→入力タブ→「ライセンスキー」に購入で発行されたキー→「ライセンスで解除」
- 無料/Pro境界（実装済み）: 無料=テンプレ5種・音声1日3回 / Pro=無制限

### 3.（任意・小掃除）
- 重複の **無印 `sukatto-schedule` プロジェクトを削除**（取り違え防止。アプリ本番は `-oeyl`）
- ビルドログのTS警告解消: `schedule/` に `@types/node` 追加＋ `api/*.ts` 用 tsconfig で `types:["node"]`（`Buffer`/`process` の TS2591。**非致命・実行時は正常**なので急がない）

## 検証フェーズで見る指標（Vercel Web Analytics → Events）
無料ローンチ→支払い意思の検証。逆算で「Pro到達まで来る人数」を見る。
- `lp_try_clicked`（LP→アプリ転換）
- `app_opened` → `event_registered`（**アクティベーション＝最重要**）
- `pro_cta_clicked` / `pro_unlocked`（**支払い意思**）
- `voice_limit_hit` / `template_limit_hit`（無料上限の効き具合）

## 開発メモ
- ローカルの本体リポジトリ（`apps/`）は作業途中の未コミット変更あり。コードの正は **origin/main**。コード変更時は `git worktree add <path> origin/main` でクリーンに作業→PR→main マージ（LP/アプリのVercelが自動デプロイ）。
- このNext.js LPは Next 16（Turbopack/App Router）。`app/` のみビルドされ `schedule/` は別ツールチェーン（root tsconfig で `schedule` を exclude 済み）。
- 静的(Vite)プロジェクトのWeb Analyticsは「Enable→再デプロイ」で `/_vercel/insights/script.js` が200配信される（Next.jsは自動）。
- 関連事業/収益化方針はメモリ参照（無料ローンチ→検証→売れてから最小paywall。買い切り一本・サブスクなし）。
