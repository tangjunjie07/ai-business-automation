# RLS テナント分離テスト手順

本ドキュメントは、Row-Level Security（RLS）によるテナント分離の検証手順をまとめたものです。

- X-Tenant-ID ヘッダによるアクセス分離
- DBセッション変数 app.current_tenant_id の整合性
- 不正テナントアクセスの拒否

詳細な運用・検証手順は FINAL_RELEASE_GUIDE.md を参照してください。
