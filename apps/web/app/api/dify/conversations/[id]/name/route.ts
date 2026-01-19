
import { NextRequest, NextResponse } from 'next/server'

import { dify, getDifyKey } from '@/config'



// POST /api/dify/conversations/[id]/name

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const conversationId = params.id;
  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id未指定' }, { status: 400 });
  }
  const user = req.headers.get('x-user-id') 
  const DIFY_API_KEY = getDifyKey();
  const DIFY_API_BASE = dify?.apiBase || '';
  if (!DIFY_API_BASE) {
    return NextResponse.json({ error: 'Dify API base が設定されていません' }, { status: 500 });
  }
  // Dify API: POST /conversations/{conversation_id}/name
  const difyRes = await fetch(`${DIFY_API_BASE.replace(/\/$/, '')}/conversations/${conversationId}/name`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auto_generate: true,
      user
    })
  });
  if (!difyRes.ok) {
    const text = await difyRes.text().catch(() => '')
    return NextResponse.json({ error: 'Dify取得失敗', status: difyRes.status, body: text }, { status: 502 });
  }
  const data = await difyRes.json();
  // Dify APIのレスポンスにname/titleが含まれている前提
  return NextResponse.json({ name: data.name || data.title || '' });
}

// runtime declaration removed — using default runtime
