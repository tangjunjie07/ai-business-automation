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
    const summary: any[] = [];
    for (const [key, val] of form.entries()) {
      if (val instanceof File) {
        summary.push({ key, type: 'file', name: val.name, size: val.size, mime: val.type });
        forward.append('file', val, val.name);
      } else {
        summary.push({ key, type: 'field', value: String(val) });
        forward.append(key, String(val));
      }
    }
    console.info('Incoming upload form summary:', JSON.stringify(summary));

    const candidates = [
      `${apiBase.replace(/\/$/, '')}/files/upload`,
      `${apiBase.replace(/\/$/, '')}/v1/files/upload`,
      `${apiBase.replace(/\/$/, '')}/files`,
      `${apiBase.replace(/\/$/, '')}/v1/files`,
    ];

    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
    let lastError: { status: number; body: string } | null = null;
    let data: any = null;
    let usedUrl: string | null = null;

    for (const url of candidates) {
      try {
        const resp = await fetch(url, { method: 'POST', headers, body: forward as any });
        if (!resp.ok) {
          const text = await resp.text();
          console.warn('Dify upload candidate failed', url, resp.status, text);
          lastError = { status: resp.status, body: text };
          // try next candidate
          continue;
        }

        data = await resp.json();
        usedUrl = url;
        break;
      } catch (e: any) {
        console.error('Dify upload candidate exception', url, e?.message || String(e));
        lastError = { status: 500, body: String(e?.message || e) };
      }
    }

    if (!data) {
      // No candidate succeeded — return last error if available
      console.error('Dify upload failed for all candidates', lastError);
      return NextResponse.json({ error: lastError?.body || 'upstream error' }, { status: lastError?.status || 500 });
    }

    // 画像プレビュー用 URL をクライアントに返す
    // 上流が preview_url や source_url を返す場合はそれを優先し、なければ組み立てる
    const previewUrl = data?.preview_url || data?.source_url || data?.previewUrl || (apiBase ? `${apiBase.replace(/\/$/, '')}/files/${data.id}/preview` : undefined);
    return NextResponse.json({ ...data, previewUrl }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
