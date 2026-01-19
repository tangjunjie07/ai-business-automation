import { NextRequest, NextResponse } from 'next/server'
import config, { getDifyKey, dify } from '@/config'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
  const { task_id } = await params

  // リクエストボディからuserを取得
  const body = await req.json()
  const { user } = body

  if (!user) {
    return NextResponse.json({ error: 'user is required' }, { status: 400 })
  }

  // x-tenant-id ヘッダーを取得（必須）
  const tenantId = req.headers.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 })
  }

  // Dify APIへリクエスト
  const DIFY_API_KEY = getDifyKey()
  const DIFY_API_BASE = dify?.apiBase || config.dify?.apiBase
  if (!DIFY_API_BASE) {
    return NextResponse.json({ error: 'Dify API base が設定されていません' }, { status: 500 })
  }

  try {
    const difyRes = await fetch(`${DIFY_API_BASE.replace(/\/+$/, '')}/chat-messages/${task_id}/stop`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user })
    })

    if (!difyRes.ok) {
      const errorData = await difyRes.json().catch(() => ({}))
      return NextResponse.json({ error: errorData.message || 'Dify API error' }, { status: difyRes.status })
    }

    const data = await difyRes.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Stop API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}