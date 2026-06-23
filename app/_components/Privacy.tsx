import Link from "next/link";

// プライバシー特化の訴求。アプリの実装事実に基づく（誇張しない）。

export default function Privacy() {
  return (
    <section className="section">
      <div className="wrap">
        <span className="eyebrow">プライバシー設計</span>
        <h2 className="section-title">あなたの予定を、預かりません。</h2>
        <div className="glass privacy-card">
          <div className="shield" aria-hidden>
            🔒
          </div>
          <div>
            <p className="lead" style={{ marginTop: 0 }}>
              解析はすべてあなたの端末の中で行います。スカッと予定は予定の内容を保存するサーバーを持ちません。
            </p>
            <ul className="privacy-list">
              <li>音声・写真・テキストの解析は端末内のAIで完結</li>
              <li>カレンダーの認証情報は端末内のみ・私たちは受け取りません</li>
              <li>登録はあなたのカレンダー（Google/Outlook/iCloud）へ直接</li>
              <li>計測はCookieも個人識別もしないプライバシー配慮型のみ</li>
            </ul>
            <p style={{ marginTop: 14, fontSize: "0.88rem" }}>
              詳しくは{" "}
              <Link href="/privacy" style={{ color: "var(--accent)" }}>
                プライバシーポリシー
              </Link>{" "}
              をご覧ください。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
