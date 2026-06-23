import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 親リポ(モノレポ)と worktree の両方に lockfile があるため、
  // このディレクトリを明示してワークスペースルートの誤検出を防ぐ。
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
