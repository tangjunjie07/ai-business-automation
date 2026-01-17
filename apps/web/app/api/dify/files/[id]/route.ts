import { NextResponse } from 'next/server';
import config, { getDifyKey } from '@/config';

export const runtime = 'edge';

// サーバー側プロキシ: 指定 ID のファイルを Dify に削除依頼する
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const apiBase = config.dify?.apiBase;
    const apiKey = getDifyKey();
    if (!apiBase) return NextResponse.json({ error: 'Dify API base が設定されていません' }, { status: 500 });

    const resp = await fetch(`${apiBase}/files/${id}`, {
      method: 'DELETE',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });

    if (!resp.ok) {
      const body = await resp.text();
      return NextResponse.json({ error: body }, { status: resp.status });
    }

    return NextResponse.json({ result: 'success' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
