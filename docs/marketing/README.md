# スカッと予定 マーケティング資産

集客・収益化の実行で使い回す資産をここに置く。全チャネルで言葉と見せ方をブラさないための単一の参照元（source of truth）。

## 戦略の全体像
- **プラン本体**: `~/.claude/plans/zany-sleeping-squirrel.md`（Context / フェーズ / リスク / 検証基準）
- **核となる方針**: ゼロベース × ¥980買い切り × 1日1時間 → 「一度作れば効き続けるストック型チャネル（Google Play掲載・SEO・技術記事）」を主軸に、owned発信（X/note）を長期で並走。優先は**まず量（認知）**。

## ファイル一覧
| ファイル | 内容 | 使う場面 |
|---|---|---|
| [positioning.md](positioning.md) | 統一ポジショニング（コア3行＋媒体別ワンライナー） | 全チャネル共通の言葉の土台 |
| [demo-video-storyboard.md](demo-video-storyboard.md) | デモ動画/GIFの絵コンテ | ストア・記事・X・LPで使い回す最重要アセット |
| [google-play-listing.md](google-play-listing.md) | Google Play 掲載文一式（ASO） | Phase 1-① ストア公開 |

## 前提（固定・動かさないもの）
- **App名**: OAuth同意画面は "Skatto Schedular"（審査済み）から**変更しない**＝再審査リスク回避。ブランド名・スコープ・同意画面は凍結。
- **課金**: 買い切りPro ¥980（Gumroad `lavli`、稼働済み）。無料＝テンプレ5種・音声1日3回。
- **計測ファネル**: `LP PV → lp_try_clicked → app_opened → event_registered → voice/templateLimitHit → proCtaClicked → proUnlocked`（Vercel Web Analytics）。チャネル別UTM（zenn/note/x/play）で流入源を分離。
