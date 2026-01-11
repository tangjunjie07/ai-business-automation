# apps/web/config

このフォルダには `apps/web` で利用する統合設定モジュールの実装を置きます。

利用方法（例）
```ts
import config from '../config'
console.log(config.database.url)
```

注意
- `NEXT_PUBLIC_*` の値は Next.js のビルド時に埋め込まれます。クライアント向けの環境差分がある場合は環境ごとにビルドしてください。
