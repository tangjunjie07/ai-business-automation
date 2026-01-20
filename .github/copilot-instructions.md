# Copilot運用ガイド（Webアプリ用）

## API実装時の注意
API実装する際は、必ず下記のAPIドキュメント（公式仕様）を事前に確認してください。
- [docs/DifyAPI.md](../apps/web/docs/DifyAPI.md)
このドキュメントを参照せずにAPI設計・実装・修正を行うことは禁止します。

## 対象範囲
- 本ガイドは `apps/web/` 配下のNext.js/フロントエンドアプリの開発・AI実装支援に特化しています。

## 開発・実装ルール
- すべてのAI/Dify API実装は docs/AI_IMPLEMENTATION_RULES.md のルールに従うこと。
- サーバーサイドAPI（`apps/web/app/api/dify/`）経由でDify APIを利用し、クライアントから直接Dify APIを呼ばない。
- API実装時はリクエストバリデーション・エラーハンドリング・テナント分離（x-tenant-idヘッダー）を必ず考慮。
- 既存のUI/UX・型・ディレクトリ構成に合わせて最小限の差分で編集する。
- 新規ファイル追加時は簡単なREADMEと型定義を添付する。
- DBスキーマ変更時は `apps/web/docs/DB_MIGRATION.md` の手順に従い、安全にマイグレーションを実行する。

## テスト・検証
- `npm run validate:ai-rules` でAI実装ルール違反を自動検出。
- フロントエンドの動作確認は `apps/web/` 配下で `npm run dev` を推奨。
- AIフロントエンド実装完了後は `npx tsc --noEmit` でTypeScriptエラーを解消すること。

## 注意事項
- AI実装・Dify API関連の実装ルールは必ず docs/AI_IMPLEMENTATION_RULES.md を参照し、厳守してください。
- secretsやAPIキーは絶対にクライアントへ渡さない。
- ルール例外が必要な場合は日本語で根拠コメントを記載し、PRで説明すること。

---

（Pythonやバックエンドサービスに関する記載は本ガイドには含めません）

## DB UI (Prisma Studio)

ローカルで Prisma Studio を起動して DB の UI を開くには、`apps/web` ディレクトリで下記を実行します。

Unix（macOS / Linux / WSL）の例:

```bash
cd apps/web
set -a && [ -f .env.local ] && source .env.local || true && set +a
npx prisma studio
```

このコマンドは `.env.local` から `DATABASE_URL` を読み込み、Prisma Studio を起動します。Studio のデフォルト URL は `http://localhost:5555` です。

起動を停止するにはターミナルで `Ctrl+C` を押すか、必要であれば以下でプロセスを終了できます：

```bash
pkill -f "prisma studio"
```

## DBスキーマ変更時の手順
1. `apps/web/prisma/schema.prisma` を編集し、必要なモデル・リレーションを追加/修正/削除する。
2. 設計ドキュメント（本ファイル等）も最新化。
3. 下記コマンドを `apps/web` ディレクトリで順に実行：
   ```bash
   DATABASE_URL="<接続URL>" npx prisma migrate dev --name <migration_name>
   DATABASE_URL="<接続URL>" npx prisma generate
   # 必要に応じて
   DATABASE_URL="<接続URL>" npx tsx prisma/seed.ts
   ```
4. 本番・ステージング反映時は `DB_MIGRATION_GUIDE.md` の安全運用手順に従うこと。

