import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from "./_lib/site";

// 欧文ディスプレイ（ワードマーク・見出し・数字）。日本語本文はCSSの端末フォント。
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const description =
  "話す・撮る・打つだけで、Google・Outlook・iCloudカレンダーに1タップ登録。端末内AIで解析し、予定をサーバーに保存しない、プライバシー特化の無料スケジュール入力アプリ。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description,
  keywords: [
    "カレンダー", "音声 予定 登録", "複数カレンダー 一元管理", "スケジュール アプリ",
    "Google カレンダー", "Outlook", "iCloud", "予定 写真 取り込み", "PWA",
  ],
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#060a18",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="ja" className={display.variable}>
      <body>
        {children}
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.outbound-links.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
