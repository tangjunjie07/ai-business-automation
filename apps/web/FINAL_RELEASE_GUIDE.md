# apps/web - 最終リリースガイド（統合）

目的
- 本書は `apps/web` のリリース準備に必要な設定、CI手順、シークレット一覧、RLS検証、監視導入、DBマイグレーション、実行スクリプトの参照を一箇所にまとめた運用向けの最終ドキュメントです。

重要な前提
- 機密情報はリポジトリに含めず、GitHub Secrets / クラウドシークレットマネージャで管理すること。
- Next.js のクライアント向け設定（`NEXT_PUBLIC_*`）はビルド時に固定されるため、環境ごとにビルドする運用を採ること。

1) 主要環境変数（配置属性）
- ランタイム: `NODE_ENV`, `RELEASE_PROFILE`, `NEXT_PUBLIC_ENV`
- データベース: `DATABASE_URL`
- 認証 (NextAuth): `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- ストレージ: `STORAGE_PROVIDER`, `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- 監視: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`
- 外部サービス: `INGESTION_URL`
- マイグレーション: `MIGRATIONS_ENABLED`
- 機能フラグ（例）: `FEATURE_ENABLE_NEW_OCR`

2) 必須 GitHub Secrets（登録一覧）
- ステージング: `DATABASE_URL_STAGING`, `NEXTAUTH_URL_STAGING`, `NEXTAUTH_SECRET_STAGING`, `STORAGE_PROVIDER_STAGING`, `AWS_S3_BUCKET_STAGING`, `AWS_REGION_STAGING`, `AWS_ACCESS_KEY_ID_STAGING`, `AWS_SECRET_ACCESS_KEY_STAGING`, `INGESTION_URL_STAGING`, `SENTRY_DSN_STAGING`, `SENTRY_TRACES_SAMPLE_RATE_STAGING`, `DEPLOY_API_KEY_STAGING`
- プロダクション: `DATABASE_URL_PROD`, `NEXTAUTH_URL_PROD`, `NEXTAUTH_SECRET_PROD`, `STORAGE_PROVIDER_PROD`, `AWS_S3_BUCKET_PROD`, `AWS_REGION_PROD`, `AWS_ACCESS_KEY_ID_PROD`, `AWS_SECRET_ACCESS_KEY_PROD`, `INGESTION_URL_PROD`, `SENTRY_DSN_PROD`, `SENTRY_TRACES_SAMPLE_RATE_PROD`, `DEPLOY_API_KEY_PROD`

4) RLS とアプリ側テナント検証
- 手順書: `apps/web/RLS_TENANT_TEST.md` を参照。主なチェック項目:
  - `X-Tenant-ID` ヘッダ経由での取得/作成の分離
  - DB session variable (`app.current_tenant_id`) とアプリミドルウェアの整合性
  - 未指定/不正テナントの拒否
- スクリプト: `apps/web/scripts/rls_test.sh` を使って簡易検証が可能。

5) 監視（Sentry）導入
- 最小手順:
  1. Sentry プロジェクトを作成し DSN を取得
  2. CIのSecretsに `SENTRY_DSN_*` を登録
  3. `@sentry/nextjs` を `apps/web` にインストールし、ルートに `sentry.client.config.js` / `sentry.server.config.js` を配置（リポジトリの雛形を参照）
  4. ステージングでエラー受信確認とアラート設定

6) DB マイグレーション手順（短縮）
- バックアップ: `pg_dump -Fc -f backup-$(date +%F).dump <db>` と検証復元
- ステージングで `prisma migrate deploy`（または使用しているツール）→ スモークテスト
- 本番: 事前通知とメンテナンスウィンドウで `prisma migrate deploy` → スモークテスト
- ロールバック: 必要時は `pg_restore` でバックアップから復元（事前に手順を検証しておく）

7) 付録: 参照ファイル
- 設定統合設計: `apps/web/CONFIG_INTEGRATION.md`
- RLS テスト: `apps/web/RLS_TENANT_TEST.md`
- Sentry 利用メモ: `apps/web/SENTRY_USAGE.md`
- DB マイグレーション: `apps/web/DB_MIGRATION.md`
- CI スニペット: `apps/web/CI_SNIPPETS.md` (削除予定—本ドキュメントに統合済み)
- シークレット一覧: `apps/web/SECRETS_LIST.md`
- 設定モジュール: `apps/web/config/index.ts`
- RLS テストスクリプト: `apps/web/scripts/rls_test.sh`

補足
- ここでの「ビルド時に生成する `.env.production`」は CI のみに限定し、実際の本番環境のランタイムではクラウドのSecret/Config管理を使うことを推奨します。

承認と次の作業
- ドキュメント内容を確認いただければ、以下を実行します:
  - (A) デプロイジョブ内のプレースホルダを指定のデプロイ手順に差し替える
  - (B) 追加で不要と判断したファイルを削除する（次節で一覧提示のうえ実行）
