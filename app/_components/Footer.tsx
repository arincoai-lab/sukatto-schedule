import { SITE_NAME, SITE_URL } from "../_lib/site";

// フッター: 法務リンク + コピーライト。
// プライバシー/利用規約は絶対URLで出す。Google OAuth審査のホームページ要件は
// 「同意画面に登録した privacy URL と一致するリンク」を自動チェックするため、
// 相対パス(/privacy)だと検出されないことがある。SITE_URL 基準の絶対URLにする。
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div>
          © {year} {SITE_NAME}
        </div>
        <div className="footer-links">
          <a href={`${SITE_URL}/privacy`}>プライバシーポリシー</a>
          <a href={`${SITE_URL}/terms`}>利用規約</a>
        </div>
      </div>
    </footer>
  );
}
