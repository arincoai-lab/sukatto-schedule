import Link from "next/link";
import TryButton from "./TryButton";
import { SITE_NAME } from "../_lib/site";

// 固定ナビ。ワードマーク + CTA。
export default function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="wordmark">
          <span className="dot" aria-hidden />
          {SITE_NAME}
        </Link>
        <TryButton from="nav" label="使ってみる" variant="ghost" />
      </div>
    </nav>
  );
}
