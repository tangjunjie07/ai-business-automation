import { NextRequest, NextResponse } from 'next/server'
import { dify, getDifyKey } from '@/config'

// GET: /api/dify/messages?conversation_id=xxx
export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversation_id') || ''
  const userId = req.headers.get('x-user-id') || ''
  if (!conversationId || !userId) {
    return NextResponse.json({ error: 'conversation_id, x-user-id必須' }, { status: 400 })
  }
  // Dify APIへプロキシ（configから取得）
  const apiKey = getDifyKey();
  const difyBase = dify.apiBase || 'https://api.dify.ai';
  const url = `${difyBase}/messages?conversation_id=${conversationId}&user=${userId}`;
  console.log('[DIFY API] GET url:', url);
  const difyRes = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const text = await difyRes.text();
  let data;
  try {
    data = text ? JSON.parse(text) : { data: [], limit: 20, has_more: false };
  } catch (e) {
    return NextResponse.json({ error: 'Dify APIレスポンス不正', detail: text }, { status: 502 });
  }
  return NextResponse.json(data, { status: difyRes.status });
}

// runtime declaration removed — using default runtime
