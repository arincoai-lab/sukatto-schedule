import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../_components/Nav";
import Footer from "../_components/Footer";
import { getAllPosts, formatDate } from "./_lib/posts";
import { SITE_NAME } from "../_lib/site";

export const metadata: Metadata = {
  title: "ブログ",
  description: `${SITE_NAME}の開発の裏側と、予定入力を軽くするヒント。音声・写真での予定登録、複数カレンダー連携、端末内AIのしくみなど。`,
  alternates: { canonical: "/blog" },
  robots: { index: true, follow: true },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <>
      <Nav />
      <main className="legal">
        <Link href="/" className="back">
          ← トップへ戻る
        </Link>
        <h1>ブログ</h1>
        <p className="updated">開発の裏側と、予定入力を軽くするヒント。</p>

        {posts.length === 0 ? (
          <p>準備中です。もうすぐ最初の記事を公開します。</p>
        ) : (
          <ul className="post-list">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="post-card glass">
                  <span className="post-date">{formatDate(p.date)}</span>
                  <span className="post-title">{p.title}</span>
                  <span className="post-desc">{p.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
