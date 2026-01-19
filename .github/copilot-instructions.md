
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

