# DBマイグレーション・スキーマ変更運用ガイド（Prisma v7/独自SQL/安全運用）

## 1. スキーマ変更・反映の基本フロー
1. `prisma/schema.prisma` を編集（モデル定義・リレーション等）
2. 必要に応じて `init-db.ts` も修正（独自SQLでDDLを流す場合）
3. 設計ドキュメント（`current_implementation.md` など）も最新化
### 反映コマンド例（開発環境）
```bash
# DBスキーマを直接初期化・反映（独自SQL/DDL併用時）
npx tsx init-db.ts
# Prisma Client型再生成
npx prisma generate
# 初期データ投入（必要に応じて）
npx tsx prisma/seed.ts
```
### Prismaマイグレーション履歴を使う場合
```bash
npx prisma migrate dev --name <migration_name>
# DB同期がずれた場合
npx prisma migrate reset --force
```
## 2. 本番・ステージングでの安全な運用手順

1. バックアップ取得
	- `pg_dump -h <host> -U <user> -Fc -f backup-$(date +%F).dump <db>`
	- テスト復元で整合性確認推奨
2. ステージングでマイグレーション実行
	- `prisma migrate deploy` またはプロジェクト標準コマンド
	- スモークテスト（主要API/画面/テナント分離）
3. 本番で実行（メンテナンスウィンドウ推奨）
	- `prisma migrate deploy` 実行
4. スモークテスト・モニタリング
	- ヘルスチェック、主要API/画面、RLS動作確認
5. ロールバック手順も事前検討
	- `pg_restore` で復元可能な状態を維持
### チェックポイント
- バックアップ取得・検証済み
- スモークテスト合格
- モニタリング・アラート正常
## 3. 注意・運用Tips
- Prisma Clientを使う場合は `npx prisma generate` で型を必ず再生成
- DBスキーマ・Prismaモデル・init-db.tsの内容を常に同期
- 破壊的変更・データ消失を伴う操作は必ずバックアップ・検証後に実施

---

不明点は開発チームまでご相談ください。
