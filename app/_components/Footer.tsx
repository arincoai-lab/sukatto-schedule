import Link from "next/link";
import { SITE_NAME } from "../_lib/site";

// フッター: 法務リンク + コピーライト。
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div>
          © {year} {SITE_NAME}
        </div>
        <div className="footer-links">
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/terms">利用規約</Link>
        </div>
      </div>
    </footer>
  );
}
