# スカッと予定 — ローンチ進捗 & 次にやること

> このファイルは作業のハンドオフ。次回はここを見れば続きから始められる。最終更新: 2026-07-08

## 主要URL / プロジェクト
- **LP**: https://sukatto.rt-ai-lab.com （Vercelプロジェクト `sukatto-schedule-grin` / root Next.js）
- **アプリ**: https://app.sukatto.rt-ai-lab.com （Vercelプロジェクト `sukatto-schedule-oeyl` / `schedule/` Vite）
- リポジトリ: `arincoai-lab/sukatto-schedule`（モノレポ。root=`apps/`、LP=`app/`、アプリ=`schedule/`）
- DNS: ConoHa（GMO）でCNAME管理
- 計測: Vercel Web Analytics（各プロジェクトの Analytics タブ）

## ✅ 完了済み（本番反映済み）
- コード: 入力特化UX（入力を下部集約・カレンダー上・接続中チップ・クイック登録横スクロール）、テンプレ編集＋作成/登録時の開始/終了調整、モーダルの下付けボトムシート、買い切りPro土台、LP、プライバシー/利用規約（Google Limited Use込み）
- ドメイン: LP・アプリともサブドメイン割当・SSL有効
- Google OAuth: **本番公開（In production）＋審査承認済み（2026-07-08）** ＝「未確認アプリ」警告と100人枠が解除され、誰でも警告なしで利用可。スコープ=**最小化済み**（`calendar.events`（承認対象・sensitive） + `calendar.calendarlist.readonly`（非機密）。フル `auth/calendar` は廃止。実装 `schedule/src/calendar/google-auth.ts`、Console登録も同じ2つ）
  - **⚠️承認の維持条件（Googleの通知より）**: 同意画面の設定変更・スコープ追加をすると**再審査が必要**。審査済み構成（App name「Skatto Schedular」/ homepage=LP / privacy / terms / スコープ2つ）は動かさないこと。Project Owner/Editor のアカウントを最新に保つ（連絡先 `arincoai@dontsleep-man-blog.com`）。
- Gumroad 買い切りPro: **本番稼働中（2026-07-04）**。商品「Sukatto Schedular Pro」（permalink `lavli`、https://arincoai.gumroad.com/l/lavli ）、Vercel `-oeyl` に `GUMROAD_PRODUCT_ID` / `VITE_PRO_PURCHASE_URL` 設定済み。有効キー→valid / 無効キー→fail-close を本番確認済み。
- 品質基盤: PR #14→#15→#17 まで全て main マージ・本番反映済み（バグ修正3件＋webcal://修正・vitest 57件・ESLint・CSP Report-Only・Originチェック・Pro再検証・providers.ts抽象化）
- Web Analytics: LP・アプリ両方で稼働（PV＋カスタムイベント）

## 🎉 OAuth審査 承認（2026-07-08）
検証センターから承認メール受領（project 253285776182 / myschedular-project、対象スコープ `.../auth/calendar.events`）。差し戻し4回（homepage要件×2・ブランド名不一致・privacy 5項目）を経て通過。**「未確認アプリ」警告と100人枠の制約が外れ、一般公開の最後のゲートが解消**。
- 承認後にやる確認: シークレットウィンドウ等の未接続状態で「Googleに接続」→ 同意画面に「このアプリはGoogleで確認されていません」警告が**出ない**ことを実機確認
- **やってはいけないこと**: 同意画面の設定変更・スコープ追加（→再審査になる）。承認は継承されない＝新スコープは新規審査が必要

## ⏳ 次にやること（優先順）

### 1. 本番の実機一巡確認＋CSP昇格（PR #17反映済み・未確認）
PR #17（品質改善7コミット）が本番反映済みなので、一巡確認がまだなら実施:
1. 本番アプリで一巡操作: Google接続→音声入力→写真OCR→AI解析(WebLLM DL含む)→3社同時登録→iCloud/ICS表示→**webcal:// のICS購読（本命バグ修正の確認）**→月カレンダー表示（Outlook/iCloudのみ接続時）
2. DevTools Consoleに `[Report Only]` のCSP違反が**出ないこと**を確認（出たら該当ホストを `schedule/vercel.json` の該当ディレクティブに追加）
3. 違反ゼロを確認したら `schedule/vercel.json` のヘッダ名 `Content-Security-Policy-Report-Only` → `Content-Security-Policy` に変更してデプロイ

### 2. 検証フェーズ＝集客開始（審査ゲートが外れたのでマーケ解禁）
未確認警告が消えた今がソフトローンチの好機。LP・課金導線・計測は全て稼働済み。
- note/X などで紹介（x-writer / note-writing-assistant スキル活用）
- 下記の指標でアクティベーションと支払い意思を観測

### 3.（任意・小掃除）
- 重複の **無印 `sukatto-schedule` プロジェクトを削除**（取り違え防止。アプリ本番は `-oeyl`）
- Outlook連携の再開判断（Azure無料サインアップが必要・保留中）

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
