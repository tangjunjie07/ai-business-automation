
# プロジェクト構成

```
apps/web/
├── app/              # Next.js アプリ本体（ページ・API・UIコンポーネント等）
│   ├── api/          # APIルート（サーバーサイドAPI）
│   ├── auth/         # 認証関連
│   ├── chat/         # チャット機能
│   ├── components/   # UIコンポーネント
│   ├── dashboard/    # 管理・ダッシュボード
│   ├── hooks/        # Reactカスタムフック
│   ├── lib/          # ライブラリ・ユーティリティ
│   ├── styles/       # スタイル
│   ├── super-admin/  # スーパ管理者用画面
│   └── ...           # その他ページ・レイアウト等
├── config/           # 設定ファイル
├── docs/             # 開発・API・DB等のドキュメント
├── prisma/           # Prismaスキーマ・マイグレーション・DB種別
├── public/           # 静的ファイル（画像・アイコン等）
├── scripts/          # シェルスクリプト等
├── types/            # 型定義（TypeScript）
├── ...               # その他設定・ビルド・CI/CD関連
```

各ディレクトリの詳細はコメント参照。

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).


## セットアップ手順（日本語）

### 1. 依存パッケージのインストール

```bash
cd apps/web
npm install
```

### 2. Next.js アプリの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて動作を確認できます。

### 3. Prisma Studio (DB UI) の起動

DB の UI をローカルで確認したい場合は、下記コマンドを実行してください。

```bash
cd apps/web
set -a && [ -f .env.local ] && source .env.local || true && set +a
npx prisma studio
```

Studio のデフォルト URL は [http://localhost:5555](http://localhost:5555) です。

停止はターミナルで `Ctrl+C` または `pkill -f "prisma studio"` で可能です。

---

## Getting Started (English)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
