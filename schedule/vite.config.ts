import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fetchIcs } from "./server/ics-proxy";
import { forwardCaldav } from "./server/caldav-proxy";

// ローカル開発で /api/ics を本番(Vercel Function)と同じロジックで提供するミドルウェア。
function icsProxyDevPlugin(): Plugin {
  return {
    name: "ics-proxy-dev",
    configureServer(server) {
      server.middlewares.use("/api/ics", async (req, res) => {
        const reqUrl = (req as { url?: string }).url ?? "";
        const url = new URL(reqUrl, "http://localhost").searchParams.get("url");
        const result = await fetchIcs(url);
        if (!result.ok) {
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.end(result.body);
      });
    },
  };
}

// ローカル開発で /api/caldav を本番と同じロジックで提供する（POST JSON中継）。
function caldavProxyDevPlugin(): Plugin {
  return {
    name: "caldav-proxy-dev",
    configureServer(server) {
      server.middlewares.use("/api/caldav", async (req, res) => {
        const method = (req as { method?: string }).method ?? "GET";
        if (method.toUpperCase() !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "POSTのみ受け付けます" }));
          return;
        }
        const chunks: Uint8Array[] = [];
        for await (const c of req as AsyncIterable<Uint8Array>) chunks.push(c);
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          merged.set(c, off);
          off += c.length;
        }
        let result;
        try {
          const payload = JSON.parse(new TextDecoder("utf-8").decode(merged));
          result = await forwardCaldav(payload);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "リクエストボディが不正です" }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      });
    },
  };
}

// 静的PWA + ICS取得用の極小プロキシ（CORS回避のみ）。
export default defineConfig({
  plugins: [
    react(),
    icsProxyDevPlugin(),
    caldavProxyDevPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png"],
      manifest: {
        id: "/",
        name: "Skatto Schedular",
        short_name: "Skatto Schedular",
        description: "話す・撮るだけで予定が入る入力特化スケジュールアプリ",
        lang: "ja",
        theme_color: "#0c111c",
        background_color: "#0c111c",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        // TWA(Android)で必須なPNGのみ。SVGは別途<link rel="icon">で配信し
        // manifestには載せない(PWABuilderのSVG誤検出を避けるため)。
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // アプリシェルのみプリキャッシュ。WebLLM/Tesseractの大容量チャンクは
        // オンデマンドDL（ブラウザHTTPキャッシュに委譲）し、プリキャッシュ対象外にする。
        globPatterns: ["**/*.{css,html,svg,png,woff2}", "assets/index-*.js", "assets/workbox-*.js"],
        globIgnores: ["**/webllm-*.js", "**/tesseract-*.js"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Tesseractは名前付きチャンクに分離（プリキャッシュ除外のため）。
        // WebLLMはバンドルせずCDN実行のためここには現れない。
        manualChunks(id) {
          if (id.includes("tesseract.js")) return "tesseract";
          return undefined;
        },
      },
    },
  },
  server: {
    host: true, // 同一LANのスマホ実機から http://<PCのIP>:5173 で確認可能
  },
});
