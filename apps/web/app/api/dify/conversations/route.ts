import { NextRequest, NextResponse } from 'next/server'
import { dify, getDifyKey } from '@/config'

// GET: /api/dify/conversations
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || ''
  if (!userId) {
    return NextResponse.json({ error: 'x-user-id必須' }, { status: 400 })
  }
  const apiKey = getDifyKey()
  const difyBase = dify.apiBase || 'https://api.dify.ai'
  const url = `${difyBase}/conversations?user=${userId}`
  const difyRes = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await difyRes.text()
  let data
  try {
    data = text ? JSON.parse(text) : { data: [], limit: 20, has_more: false }
  } catch (e) {
    return NextResponse.json({ error: 'Dify APIレスポンス不正', detail: text }, { status: 502 })
  }
  return NextResponse.json(data, { status: difyRes.status })
}
