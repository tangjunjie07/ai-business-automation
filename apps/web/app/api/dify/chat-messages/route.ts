import { NextRequest, NextResponse } from 'next/server'
import config, { getDifyKey, dify } from '@/config'

export async function POST(req: NextRequest) {
  // 日本語コメント: Dify API仕様に準拠し、初回チャット時はchat_sessionsへ保存
  const body = await req.json()
  const { query, inputs, user, conversation_id, files } = body

  // Dify APIリクエストbodyを仕様通り組み立て
  const difyBody: DifyChatRequest = {
    query: query || '',
    inputs: inputs || {},
    user: user || '',
    conversation_id: conversation_id || undefined,
    response_mode: 'streaming',
    files: files || []
  }

  // Dify APIへリクエスト（APIキー・ベースURLはconfig経由で取得）
  const DIFY_API_KEY = getDifyKey()
  const DIFY_API_BASE = dify?.apiBase || config.dify?.apiBase
  if (!DIFY_API_BASE) {
    return NextResponse.json({ error: 'Dify API base が設定されていません' }, { status: 500 })
  }
  const difyRes = await fetch(`${DIFY_API_BASE.replace(/\/+$/, '')}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(difyBody),
  })

  // ストリームをそのままクライアントに転送
  if (difyRes.body && difyRes.headers.get('content-type')?.includes('text/event-stream')) {
    // 必要なら初回チャンクでconversation_idを検出しDB保存するロジックを追加可能
    return new NextResponse(difyRes.body, {
      status: difyRes.status,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        // CORSや他ヘッダーも必要に応じて転送
      },
    })
  }

  // エラー時はJSONで返す
  let errorText = await difyRes.text();
  try { errorText = JSON.parse(errorText); } catch { /* ignore */ }
  return NextResponse.json({ error: errorText }, { status: difyRes.status })
}
