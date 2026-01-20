# DBマイグレーション・スキーマ変更手順（Prisma v7/独自SQL併用）

## 1. スキーマ変更時の流れ

1. `schema.prisma` を編集し、モデル定義を更新
2. `init-db.ts` も必要に応じて修正（独自SQLでテーブル作成・変更する場合）
3. `current_implementation.md` など設計ドキュメントも最新化

## 2. 反映手順

```bash
# 1. DBスキーマを直接初期化・反映（chat_filesのtenant_id追加など）
npx tsx init-db.ts

# 2. Prisma Clientの型を再生成
npx prisma generate

# 3. 初期データ投入（例: super adminユーザー）
npx tsx prisma/seed.ts
```

## 3. 注意点
- Prismaのマイグレーション（`npx prisma migrate dev`）は、独自SQL運用時は必須ではありません。
- Prisma Clientを使う場合は、`npx prisma generate`で型を必ず再生成してください。
- DBスキーマとPrismaモデル、init-db.tsの内容が必ず一致するように管理してください。

## 4. 典型的な変更例
- テーブルにカラム追加：`schema.prisma`/`init-db.ts`/ドキュメントを全て修正→上記手順で反映
- リレーション追加：両モデルにリレーションフィールド追加→同様に反映

---

---

## 5. Prismaコマンドの運用方針

- `npx prisma migrate dev --name <name>`
	- Prismaのマイグレーション履歴管理を使う場合のみ必要。
	- 本プロジェクトはinit-db.tsで直接SQLを流す運用のため、通常は不要。
- `npx prisma generate`
	- Prisma Clientを使う場合は必須。schema.prismaを変更したら必ず実行。
- `npx tsx prisma/seed.ts`
	- 初期データ投入用。必要に応じて実行。

---

何か不明点があれば開発チームまでご相談ください。
