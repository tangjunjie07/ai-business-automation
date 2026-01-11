# Sentry 導入メモ（apps/web）

1. パッケージ追加

```bash
cd apps/web
npm install @sentry/nextjs
```

2. ルートに `sentry.client.config.js` と `sentry.server.config.js` を置く（このリポジトリに雛形あり）。

3. 環境変数（CIのSecrets）
- SENTRY_DSN
- SENTRY_ENVIRONMENT
- SENTRY_TRACES_SAMPLE_RATE

4. ステージングでエラー送信を確認し、Sentry プロジェクトでアラートを設定する。

注意: 実際のコード変更（Next.jsのビルド設定やエラーハンドリング箇所への capture 呼び出し）は別途承認をください。
