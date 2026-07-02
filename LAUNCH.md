# スカッと予定 — ローンチ進捗 & 次にやること

> このファイルは作業のハンドオフ。次回はここを見れば続きから始められる。最終更新: 2026-07-02

## 主要URL / プロジェクト
- **LP**: https://sukatto.rt-ai-lab.com （Vercelプロジェクト `sukatto-schedule-grin` / root Next.js）
- **アプリ**: https://app.sukatto.rt-ai-lab.com （Vercelプロジェクト `sukatto-schedule-oeyl` / `schedule/` Vite）
- リポジトリ: `arincoai-lab/sukatto-schedule`（モノレポ。root=`apps/`、LP=`app/`、アプリ=`schedule/`）
- DNS: ConoHa（GMO）でCNAME管理
- 計測: Vercel Web Analytics（各プロジェクトの Analytics タブ）

## ✅ 完了済み（本番反映済み）
- コード: 入力特化UX（入力を下部集約・カレンダー上・接続中チップ・クイック登録横スクロール）、テンプレ編集＋作成/登録時の開始/終了調整、モーダルの下付けボトムシート、買い切りPro土台、LP、プライバシー/利用規約（Google Limited Use込み）
- ドメイン: LP・アプリともサブドメイン割当・SSL有効
- Google OAuth: **本番公開（In production）** ＝誰でも利用可（審査前は「未確認」警告＋〜100人枠）。スコープ=**最小化済み**（`calendar.events` + `calendar.calendarlist.readonly`。フル `auth/calendar` は廃止。実装 `schedule/src/calendar/google-auth.ts`、Console登録も同じ2つ）
- Web Analytics: LP・アプリ両方で稼働（PV＋カスタムイベント）

## 🔧 マージ待ち: PR #14（コードレビュー一括修正＋品質基盤）
https://github.com/arincoai-lab/sukatto-schedule/pull/14 — スコープ/ブランディング不変＝OAuth審査に影響なし。
- バグ修正3件（月表示のOutlook/iCloudのみ接続、LLM時刻のUTCずれ、場所の正規表現クラッシュ）
- テスト基盤: vitest＋テスト57件（`cd schedule && npm test`）、ESLint（`npm run lint`）
- テストが発見した追加バグも修正済み: **webcal:// のICS購読が常に400になっていた**（URL#protocol代入は仕様上無効）
- セキュリティ: ヘッダ4種＋**CSPはReport-Only**（下記の昇格手順参照）、api/caldav・api/icsのOriginチェック
- Pro返金対策: ライセンスキー保存＋7日毎の起動時再検証（fail-open）
- リファクタ: `schedule/src/calendar/providers.ts` に3社分岐を集約（App.tsx 758→648行）
- **マージ後の実機確認**: 月カレンダー表示 / 3社同時登録 / iCloud・ICS取得 / コンソールのCSP違反レポート

### CSPをReport-Only→本適用へ昇格する手順
1. PR #14マージ後、本番アプリで一巡操作: Google接続→音声入力→写真OCR→AI解析(WebLLM DL含む)→3社同時登録→iCloud/ICS表示→Outlook接続(有効なら)
2. DevTools Consoleに `[Report Only]` のCSP違反が**出ないこと**を確認（出たら該当ホストを `schedule/vercel.json` の該当ディレクティブに追加）
3. 違反ゼロを確認したら `schedule/vercel.json` のヘッダ名 `Content-Security-Policy-Report-Only` → `Content-Security-Policy` に変更してデプロイ

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

  We request the minimum scopes needed:
  - https://www.googleapis.com/auth/calendar.events — to create, edit, delete and read
    the events the user chooses to register, and to show an agenda/month view alongside
    them. This is the core function of the app.
  - https://www.googleapis.com/auth/calendar.calendarlist.readonly — read-only, so the
    user can pick which calendar to write to. We only read calendar names/ids, never
    event contents from this scope.
  We deliberately avoid the broad https://www.googleapis.com/auth/calendar scope.

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
- ~~ビルドログのTS警告解消~~ → **PR #14で解消済み**（@types/node追加＋tsconfig types）

## 検証フェーズで見る指標（Vercel Web Analytics → Events）
無料ローンチ→支払い意思の検証。逆算で「Pro到達まで来る人数」を見る。
- `lp_try_clicked`（LP→アプリ転換）
- `app_opened` → `event_registered`（**アクティベーション＝最重要**）
- `pro_cta_clicked` / `pro_unlocked`（**支払い意思**）
- `voice_limit_hit` / `template_limit_hit`（無料上限の効き具合）

## 開発メモ
- ローカルの本体リポジトリ（`apps/`）は **origin/main と同期済み・クリーン**（2026-07-02正常化）。コード変更はブランチを切って作業→PR→main マージ（LP/アプリのVercelが自動デプロイ）。gitが固まる時は `.git/index.lock` 削除＋`git -c core.fsmonitor=false ...` を疑う。
- 品質チェック: `cd schedule && npm test`（vitest 57件）/ `npm run lint` / `npm run typecheck` / `npm run build`。**`api/` 配下は全ファイルがVercel Functionになるため、テストやヘルパーは置かない**（`server/` に置く）。
- このNext.js LPは Next 16（Turbopack/App Router）。`app/` のみビルドされ `schedule/` は別ツールチェーン（root tsconfig で `schedule` を exclude 済み）。
- 静的(Vite)プロジェクトのWeb Analyticsは「Enable→再デプロイ」で `/_vercel/insights/script.js` が200配信される（Next.jsは自動）。
- 関連事業/収益化方針はメモリ参照（無料ローンチ→検証→売れてから最小paywall。買い切り一本・サブスクなし）。
