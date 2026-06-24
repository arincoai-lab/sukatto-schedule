# スカッと予定 — 一般公開チェックリスト

このスプリントでコード側の地固め（LP・法務ページ・アナリティクス土台・買い切りPro）は完了。
残りは主に**あなた（運用者）側の設定作業**です。上から順に進めれば一般公開できます。

## 構成のおさらい
- **LP（マーケ）** = リポジトリ root の Next.js（`app/`）。SSRでSEO/OGPに強い。
- **アプリ本体** = `schedule/` の React+Vite（既存のVercelデプロイ）。
- 両者は別Vercelプロジェクト。サブドメインで繋ぐ。

## 1. ドメイン（既存 rt-ai-lab.com のサブドメイン）
DNSに2つのサブドメインを足すだけ（既存サイトに影響なし）。
- `sukatto.rt-ai-lab.com` → LP（root Next.js プロジェクト）
- `app.sukatto.rt-ai-lab.com` → アプリ（schedule プロジェクト）

Vercel: 各プロジェクトの Settings → Domains に上記を追加 → 表示されるCNAME/Aレコードを
rt-ai-lab.com のDNSに登録。

## 2. 環境変数（Vercel の各プロジェクト Settings → Environment Variables）
**LP（root Next.js）**
- `NEXT_PUBLIC_SITE_URL` = `https://sukatto.rt-ai-lab.com`
- `NEXT_PUBLIC_APP_URL` = `https://app.sukatto.rt-ai-lab.com`
- `NEXT_PUBLIC_CONTACT_EMAIL` = 問い合わせ用メール（既定: arincoai@…）

**アプリ（schedule / Vite）**
- `GUMROAD_PRODUCT_ID` = Gumroad商品のproduct_id（ライセンス検証用・サーバー側のみ）
- `VITE_PRO_PURCHASE_URL` = Gumroad商品ページのURL（「Proにする」ボタンの遷移先）

> アナリティクスは **Vercel Web Analytics** を採用済み（Cookie不要・env変数不要）。LP（`app/layout.tsx` の `<Analytics />`）とアプリ（`schedule/src/main.tsx` の `inject()`）の両方でコード組み込み済みで、`util/analytics.ts` の `track()` がカスタムイベントを送る。有効化は各Vercelプロジェクトの **Analytics タブ → Enable** を押すだけ。

## 3. Google OAuth（一般公開の最大の長期ゲート）
アプリは sensitive scope を使うため、テストユーザー以外に公開するには
**Google の審査（verification）が必要**。数日〜数週かかるので早めに着手。

**要求スコープ（必要最小限。実装は `schedule/src/calendar/google-auth.ts`）**
- `https://www.googleapis.com/auth/calendar.events` — 予定の作成/更新/削除/取得（主目的）
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly` — 書き込み先カレンダー選択用の一覧を読み取り専用で取得

> フルの `auth/calendar`（読み書き全権限）は使わない。審査では「なぜそのスコープが必要か」を必ず問われるため、上記の最小構成で正当化するのが通りやすい。Console の登録スコープも必ずこの2つに揃えること。

- Google Cloud Console → OAuth同意画面:
  - アプリのホームページ = `https://sukatto.rt-ai-lab.com`
  - プライバシーポリシー = `https://sukatto.rt-ai-lab.com/privacy`
  - 利用規約 = `https://sukatto.rt-ai-lab.com/terms`
  - 承認済みドメイン = `rt-ai-lab.com`
- 「承認済みのJavaScript生成元」に `https://app.sukatto.rt-ai-lab.com` を追加。
- 同意画面を「本番」に切替 → 審査を申請（スコープの正当化・デモ動画を提出）。
- 審査完了までは「テスト中」のままテストユーザー枠でソフトローンチ可能。

### スコープ正当化テキスト（審査フォーム貼り付け用・たたき台）
- **calendar.events**: 「ユーザーが音声/テキストで入力した予定を、本人のGoogleカレンダーにイベントとして作成・更新・削除します。本アプリの中核機能であり、イベント単位の読み書きのみで完結します。」
- **calendar.calendarlist.readonly**: 「ユーザーが『どのカレンダーに登録するか』を選べるよう、保有カレンダーの一覧（名称とID）を読み取り専用で取得します。予定の内容は読み取りません。」
- デモ動画には: 同意画面 → 「明日15時 歯医者」等の入力 → 対象カレンダー選択 → 実際に登録される様子、を15〜60秒で収める。

## 4. 買い切りPro（Gumroad）
1. Gumroad で商品を作成（応援価格 ¥500〜1,500、**ライセンスキー発行をON**）。
2. 商品の `product_id` を `GUMROAD_PRODUCT_ID` に、商品URLを `VITE_PRO_PURCHASE_URL` に設定。
3. 動作確認: アプリ設定→入力タブ→「ライセンスキー」に購入で発行されたキーを貼り「ライセンスで解除」。
   - 検証は `schedule/api/license.ts`（Gumroad license verify API）。無効・未設定時は絶対に解除しない設計。

無料/Proの境界（実装済み）:
- 無料 = クイック登録テンプレ5種類まで・音声入力1日3回まで
- Pro = すべて無制限

## 5. Vercel プロジェクト整理
- 重複していた無印 `sukatto-schedule` を削除し、`sukatto-schedule-oeyl…` を `app.sukatto.rt-ai-lab.com` に。
- root の Next.js LP は新規プロジェクトとして接続（Framework: Next.js、Root Directory: リポジトリ直下）。

## 6. デモ動画（任意・効果大）
LPヒーローの実演カードは構造を保ったまま動画/GIFに差し替え可能（`app/_components/Hero.tsx`）。
「明日15時 歯医者」と話す→登録される15〜30秒を撮るとSEO/SNSで使い回せる。

## 検証済み（このスプリント）
- LP（/・/privacy・/terms・/opengraph-image）ビルド通過・表示確認済み
- OG画像に日本語フォント埋め込み・レンダリング確認済み
- アプリ ビルド/型チェック通過
- `/api/license` は無効/未設定時に valid:false を返す（誤解除なし）を確認
- テンプレ5種上限ゲートの動作・上限バナー表示を確認
- アナリティクス `app_opened` 発火を確認
