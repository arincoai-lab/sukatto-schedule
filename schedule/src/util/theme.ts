import type { ThemeMode } from "../types";

// テーマを <html data-theme="..."> に反映し、theme-color メタタグも追従させる。
// system 指定時は端末の prefers-color-scheme をリッスンして自動切替する。
// 戻り値の関数を呼ぶとリスナーを解除できる（useEffect のクリーンアップ用）。

const THEME_COLOR_LIGHT = "#f5f7fb";
const THEME_COLOR_DARK = "#0c111c";

function effectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

function setMetaThemeColor(color: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export function applyTheme(mode: ThemeMode): () => void {
  const apply = () => {
    const t = effectiveTheme(mode);
    document.documentElement.dataset.theme = t;
    setMetaThemeColor(t === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
  };

  apply();

  if (mode === "system" && typeof window !== "undefined" && window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }

  return () => {};
}
