"use client";

import { track } from "@vercel/analytics";
import { APP_URL } from "../_lib/site";

// アプリ本体へ誘導するCTA。クリックを計測（LP→アプリの転換率を見る）。

export default function TryButton({
  variant = "primary",
  label = "無料で使ってみる",
  from,
}: {
  variant?: "primary" | "ghost";
  label?: string;
  from: string;
}) {
  const onClick = () => {
    try {
      track("lp_try_clicked", { from });
    } catch {
      /* 計測失敗は無視 */
    }
  };
  return (
    <a
      href={APP_URL}
      onClick={onClick}
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-ghost"}`}
    >
      {label}
    </a>
  );
}
