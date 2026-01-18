# AI 実装ルール / ワークフロー

このドキュメントは本プロジェクトで AI 関連コードを実装・配置する際の必須ルールとワークフローをまとめたものです。
次回プロジェクトが開かれたときに自動チェックを実行し、違反があれば CI/ローカルで検出されます。

## 目的
- セキュリティ：API キーやベース URL をクライアントに漏らさない
- 一貫性：Dify 関連の呼び出しはサーバー側経由で統一
- ローカライゼーション：コメントは日本語で記述

---

## ルール（必須）

1. コメントはすべて日本語で記述すること。
   - 単語コメントや注釈も含め、日本語（ひらがな/カタカナ/漢字）を含めてください。
   - 自動検査で英語のみのコメントを警告します（警告→レビューで修正）。

2. Dify API 呼び出しはフロントエンドから直接行ってはいけません。
   - フロントエンド（`apps/web/app` 以下のクライアントコード）は外部 Dify エンドポイントに直接 `fetch` や `axios` 等でアクセスしてはなりません。
   - Dify と連携する処理はすべて Next.js の Route（サーバーサイド API）を介して実施してください。
   - すべての Dify 用 Route は必ず `apps/web/app/api/dify` 配下に設置してください。
   - Dify APIを実装・利用する際は、必ず `docs/DifyAPI.md` のAPIドキュメントを参照し、仕様通りに実装してください。
   - フロントエンドからバックエンドAPI（/api/dify/xxx）を呼び出す際は、必ず `x-tenant-id` ヘッダーを指定すること（テナント分離・RLS制約のため必須）。
3. 環境変数 `process.env.DIFY_API_BASE`（および `NEXT_PUBLIC_DIFY_API_BASE` 等のクライアント公開変数）の直接使用は禁止。
   - Dify ベース URL / API キーは `apps/web/config/index.ts` 経由で読み込むユーティリティで解決してください。
   - フロントエンドで `process.env.NEXT_PUBLIC_DIFY_API_BASE` を参照することは禁止です（ビルド時にキーがバンドルされます）。

---

## 推奨ワークフロー（実装手順）

1. `apps/web/config/index.ts` に Dify 設定を追加/確認する。
   - 例: `export function getDifyConfig() { return { baseUrl: process.env.DIFY_API_BASE, apiKey: process.env.DIFY_API_KEY } }`
   - 注意: この関数はサーバー側でのみ安全に呼び出してください。

2. サーバー Route を作成する。
   - 配置場所: `apps/web/app/api/dify/*`
   - 例: `apps/web/app/api/dify/files/upload/route.ts` にファイルアップロードのプロキシを実装する。
   - サーバー Route 内で `apps/web/config/index.ts` を読み込み、環境変数を参照・使用する。クライアントへキーを渡さない。

3. フロントエンドはサーバー Route を叩く。
   - 例: `fetch('/api/dify/files/upload', { method: 'POST', body: formData })`

4. レビュー時に自動検査を走らせる。
   - `npm run validate:ai-rules` を実行して、違反箇所を検出します。

---

## 自動検査の範囲
- 禁止された環境変数の使用（`DIFY_API_BASE`, `NEXT_PUBLIC_DIFY_API_BASE` など）を検出して failure にする。
- `apps/web` 以下のクライアントコードで外部 Dify ドメインや `fetch('http` と `dify` を同時に含むパターンのスキャン（警告）。
- コメントの日本語チェック（英語のみのコメント行は警告）。

---

## ローカルでの実行方法
```
npm run validate:ai-rules
```

CI ではこのスクリプトを `lint` フェーズに追加することを推奨します。

---

## 例外と補足
- 既存のサーバー側コード（`apps/web/app/api/dify`）はルール遵守を前提に更新してください。
- 特殊な理由でルールの例外が必要な場合は、該当箇所に日本語で根拠コメントを追加し、PR にて説明してください。

---

作成日: 2026-01-17
