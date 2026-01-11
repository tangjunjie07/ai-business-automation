# 簡易 Sentry 統合ガイド（apps/web）

目的
- 重大な例外を即時検知し、リリースの品質を担保するために Sentry を導入する。

最小構成（Next.js）
1. Sentry プロジェクトを作成し、`DSN` を取得する。
2. 環境変数に `SENTRY_DSN` と `SENTRY_ENVIRONMENT`（例: production）を設定する。
3. パッケージをインストール（手動での導入例）:

```bash
cd apps/web
npm install @sentry/nextjs
```

4. 初期設定（参考 — 実際のコード変更は要承認）:
  - `sentry.server.config.js` / `sentry.client.config.js` をプロジェクトルートに配置。
  - `next.config.js` に Sentry の設定を追加（公式ドキュメントに従う）。

環境変数（例、`.env.production`）
- SENTRY_DSN=
- SENTRY_ENVIRONMENT=production
- SENTRY_TRACES_SAMPLE_RATE=0.05

運用上の注意
- DSN は Secrets に保管し、リポジトリに直接コミットしない。
- トレースサンプル率はコストと必要性に応じて調整する。
- 重要イベント（OCRジョブ失敗、アップロード失敗）には明示的に `Sentry.captureException` を呼ぶ。

次のステップ（提案）
- ドキュメントを元に Sentry の導入を行い、ステージングでエラー受信を確認する（私が導入コードを作る場合は別途承認をください）。
