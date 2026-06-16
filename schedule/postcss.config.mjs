// このアプリは素のCSS(styles.css)のみ使用し、PostCSSプラグインは不要。
// 明示的に空設定を置くことで、PostCSSがリポジトリ上位(create-next-app由来の
// @tailwindcss/postcss を参照するルート設定)へ遡って探索するのを止める。
// これが無いとVercel(Root Directory=schedule)で
// "Cannot find module '@tailwindcss/postcss'" によりビルドが落ちる。
export default { plugins: {} };
