import { NextResponse } from 'next/server';
import config, { getDifyKey, dify } from '@/config';

export const runtime = 'edge';

// サーバー側プロキシ: フロントエンドからのファイルアップロードを受け、Dify API に転送する
export async function POST(req: Request) {
  try {
    // `apps/web/config/index.ts` 経由で Dify の設定を取得する（process.env を直接参照しない）
    const apiBase = dify?.apiBase || config.dify?.apiBase;
    const apiKey = getDifyKey();
    if (!apiBase) return NextResponse.json({ error: 'Dify API base が設定されていません' }, { status: 500 });

    const form = await req.formData();
    const forward = new FormData();

    // Debug: summarize incoming form entries (do not log binary contents)
    const summary: { key: string; type: string; name?: string; size?: number; mime?: string; value?: string }[] = [];
    for (const [key, val] of form.entries()) {
      if (val instanceof File) {
        summary.push({ key, type: 'file', name: val.name, size: val.size, mime: val.type });
        forward.append('file', val, val.name);
      } else {
        summary.push({ key, type: 'field', value: String(val) });
        forward.append(key, String(val));
      }
    }

    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

    const url = `${apiBase.replace(/\/$/, '')}/files/upload`;
    const resp = await fetch(url, { method: 'POST', headers, body: forward });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Dify upload failed', url, resp.status, text);
      return NextResponse.json({ error: text || 'upstream error' }, { status: resp.status });
    }

    const data = await resp.json();

    // 画像プレビュー用 URL をクライアントに返す
    // 上流が preview_url や source_url を返す場合はそれを優先し、なければ組み立てる
    const previewUrl = data?.preview_url || data?.source_url || data?.previewUrl || (apiBase ? apiBase.replace(/\/$/, '') + '/files/' + data.id + '/preview' : undefined);
    return NextResponse.json({ ...data, previewUrl }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error?.message || String(err) }, { status: 500 });
  }
}
