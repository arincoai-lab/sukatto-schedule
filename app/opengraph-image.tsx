import { ImageResponse } from "next/og";

// SNSシェア用のOG画像（1200x630）。アプリの世界観（ネイビー×グロー）で生成。
// 日本語フォントをGoogle Fontsから取得して埋め込む。取得失敗時は欧文表記にフォールバックし、
// ビルドが落ちないようにする。

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "スカッと予定 — 話す・撮る・打つだけ。1タップでカレンダー登録。";

// css2 から TrueType の URL を取り出して取得（古いUAでttfを得る）。失敗時は null。
async function loadJpFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const api = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(
      text,
    )}`;
    // UAヘッダ無しのfetchにはGoogle FontsがTrueType(ttf)を返す（satoriが解釈可能）。
    const css = await (await fetch(api)).text();
    const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OgImage() {
  const jpText = "スカッと予定話す撮る打つだけで1タップカレンダー登録音声写真手入力";
  const font = await loadJpFont(jpText);
  const hasJp = font !== null;

  const title = hasJp ? "スカッと予定" : "Sukatto";
  const tagline = hasJp
    ? "話す・撮る・打つだけ。1タップでカレンダー登録。"
    : "Speak it. It's on your calendar.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
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
          <div style={{ fontSize: 40, fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.2, marginTop: 40, maxWidth: 980 }}>
          {tagline}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 48 }}>
          {["Google", "Outlook", "iCloud"].map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                fontSize: 28,
                color: "#a8b3cc",
                padding: "12px 26px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              {c}
            </div>
          ))}
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
