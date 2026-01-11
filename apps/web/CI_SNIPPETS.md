# CI / デプロイ用環境注入スニペット

以下は `apps/web` を環境ごとにビルドする際の代表的なスニペット例。

1) GitHub Actions - ビルド時に `.env.production` を生成（既にワークフローに組み込み済み）

```yaml
- name: Prepare production env file from Secrets
  run: |
    cat > apps/web/.env.production <<EOF
    NODE_ENV=production
    RELEASE_PROFILE=production
    NEXT_PUBLIC_ENV=production
    DATABASE_URL=${{ secrets.DATABASE_URL_PROD }}
    ...
    EOF
```

ポイント:
- `NEXT_PUBLIC_*` がクライアントに埋め込まれるため、クライアント挙動が環境依存なら環境ごとにビルドする必要があります。
- Secrets は GitHub Actions の `secrets` に登録して運用してください。

2) ランタイムでの切替（コンテナ / Kubernetes）

- デプロイ時に環境変数をコンテナランタイムに注入する（Kubernetesは `Secret`、Docker Composeは `.env`や `env_file`、クラウドは Secret Manager を利用）。
- Next.js のサーバー側のみ参照する変数はランタイムで差し替えられますが、クライアント公開変数はビルド時に固定されます。

3) RELEASE_PROFILE の使い方

- CI で `RELEASE_PROFILE` をセットしておき、サーバー側の `config` モジュールがプロファイルに基づいて微調整する（例: ログレベル、外部サービスのエンドポイント切替）。
