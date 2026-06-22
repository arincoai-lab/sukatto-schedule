// LPと法務ページで共有するサイト定数。ドメイン確定後は環境変数で差し替え可能。

// LP自身の公開URL（OGPの絶対URL解決に使用）。
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sukatto.rt-ai-lab.com";

// アプリ本体（Vite版）のURL。CTAリンク先。
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sukatto.rt-ai-lab.com";

// 問い合わせ先（プライバシー/利用規約の連絡先）。
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "arincoai@dontsleep-man-blog.com";

export const SITE_NAME = "スカッと予定";
export const SITE_TAGLINE = "話す・撮る・打つだけ。1タップでカレンダー登録。";
