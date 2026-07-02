import { defineConfig } from "vitest/config";

// vite.config.ts(PWA/devミドルウェア込み)を継承させず、ユニットテスト専用の最小構成にする。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
