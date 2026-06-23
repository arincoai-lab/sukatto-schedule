// プライバシー配慮の軽量イベント計測。Cookieもユーザー識別も持たない。
// Vercel Web Analytics にカスタムイベントを送る（main.tsx の inject() で初期化済み）。
// 検証用に window.__sukattoEvents へも記録する。

import { track as vercelTrack } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean>;

interface EventLogWindow {
  __sukattoEvents?: { name: string; props?: EventProps; ts: number }[];
}

/**
 * 計測イベントを送る。識別子・個人情報は渡さないこと（イベント名と非機密の属性のみ）。
 */
export function track(name: string, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    vercelTrack(name, props);
    const w = window as unknown as EventLogWindow;
    (w.__sukattoEvents ??= []).push({ name, props, ts: Date.now() });
  } catch {
    /* 計測失敗はアプリ動作に影響させない */
  }
}

// 計測イベント名（タイポ防止に定数化）
export const EVENTS = {
  appOpened: "app_opened",
  eventRegistered: "event_registered",
  voiceLimitHit: "voice_limit_hit",
  templateLimitHit: "template_limit_hit",
  proCtaClicked: "pro_cta_clicked",
  proUnlocked: "pro_unlocked",
} as const;
