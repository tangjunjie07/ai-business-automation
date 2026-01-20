# Config 統合設計（ワンページ仕様）

目的
- `apps/web` のランタイム設定を一箇所に集約し、環境切替を容易にして誤設定リスクを低減する。

要件
- 環境別プロファイル（development/staging/production/canary）をサポートする。
- 機密値は環境変数／シークレットマネージャで管理する。
- アプリ内では必ずこの統合モジュールを経由して設定を参照する。

推奨構成（モジュール）
- `apps/web/config/index.ts` （単一エクスポート `config`）
  - 例: `export const config = { runtime, database, storage, auth, sentry, featureFlags }`
  - 各セクションは型定義を持ち、デフォルト値とプロファイル上書きを適用する。

主要セクション（最小セット）
- `runtime`: { env, releaseProfile }
- `database`: { url, migrationsEnabled }
- `storage`: { provider, bucket, prefix }
- `auth`: { nextAuthUrl, secret, cookieSecure }
- `sentry`: { dsn, environment, tracesSampleRate }
- `featureFlags`: { ... }

環境値の管理方法
- `.env.development`, `.env.staging`, `.env.production` を用意し、CI/CDで適切なファイルを適用。
- 機密はCIのSecretsやクラウドシークレットマネージャに保管すること。
- ランタイム選択は `RELEASE_PROFILE`（production|staging|canary）で行う。

運用ルール（誰が何を変えるか）
- PM: `featureFlags` の切替指示（Pull Requestで変更履歴を残す）。
- SRE/運用: `database.url`, `storage.*`, `RELEASE_PROFILE` をSecretsで管理。
- 開発者: `config/index.ts` の型・既定値を変更可能。変更はステージングで検証のこと。

利用例（コード）
```
import { config } from '../config'
console.log(config.database.url)
```

移行の短い手順
1. `config/index.ts` を追加（型付き）。
2. 既存の `next.config.ts` / `prisma.config.ts` / 個別設定を段階的に `config` へ移行。
3. ステージングで動作確認（RLS・認証のエンドツーエンド）。

備考
- このドキュメントは設計要約。実装は別途承認。
