import { ImageResponse } from "next/og";
import { getAllSlugs, getPostBySlug } from "../_lib/posts";

// 記事ごとのOG画像（1200x630）。トップの opengraph-image と同じ世界観で、
// 記事タイトルを載せる。日本語フォントはGoogle Fontsから取得（失敗時は欧文フォールバック）。

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Skatto Schedular ブログ";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

async function loadJpFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const api = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(
      text,
    )}`;
    const css = await (await fetch(api)).text();
    const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const brand = "Skatto Schedular";
  const title = post?.title ?? brand;
  const jpText = `${title}${brand}スカッと予定ブログ話す撮る打つで予定は1タップ`;
  const font = await loadJpFont(jpText);
  const hasJp = font !== null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(900px 600px at 30% -10%, #18305f, transparent 60%), linear-gradient(135deg, #0c1430 0%, #04060f 100%)",
          color: "#f3f5fb",
          fontFamily: hasJp ? "Noto Sans JP" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "#6cc1ff",
              boxShadow: "0 0 40px rgba(108,193,255,0.8)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700 }}>{brand}</div>
        </div>
        <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.25, maxWidth: 1040 }}>
          {title}
        </div>
        <div style={{ fontSize: 26, color: "#a8b3cc" }}>
          {hasJp ? "ブログ — 話す・撮る・打つで、予定は1タップ。" : "Blog"}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Noto Sans JP", data: font, weight: 700 as const, style: "normal" as const }]
        : [],
    },
  );
}
