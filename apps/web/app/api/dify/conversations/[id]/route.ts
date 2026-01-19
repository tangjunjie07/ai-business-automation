import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import config, { getDifyKey, dify } from '@/config'

// グローバルPrismaインスタンス（コネクション使い回し）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaPg | undefined
  pool: import('pg').Pool | undefined
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = config.database.url
    if (!connectionString) throw new Error('DATABASE_URLが未設定です')
    globalForPrisma.pool = new Pool({ connectionString })
    globalForPrisma.adapter = new PrismaPg(globalForPrisma.pool)
    globalForPrisma.prisma = new PrismaClient({ adapter: globalForPrisma.adapter })
  }
  return globalForPrisma.prisma
}

// 会話削除API: DB(chat_sessions)とDify両方から削除
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 日本語コメント: Dify API仕様に準拠し、DBとDify両方削除
  const conversationId = (await params).id
  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id未指定' }, { status: 400 })
  }


  const user = req.headers.get('x-user-id') 
  // DBから削除（直接ロジック記述）
  try {
    await getPrisma().chatSession.delete({
      where: { difyId: conversationId }
    })
    console.log('DB deletion successful')
  } catch (e) {
    console.log('DB deletion failed:', e)
    // 存在しない場合は無視
  }

  // Dify APIから削除
  const DIFY_API_KEY = getDifyKey()
  const DIFY_API_BASE = dify?.apiBase || config.dify?.apiBase
  if (!DIFY_API_BASE) {
    return NextResponse.json({ error: 'Dify API base が設定されていません' }, { status: 500 })
  }
  const difyRes = await fetch(`${DIFY_API_BASE.replace(/\/+$/, '')}/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user: user }) // 固定ユーザーIDを使用
  })

  if (!difyRes.ok) {
    const text = await difyRes.text().catch(() => '')
    return NextResponse.json({ error: 'Dify削除失敗', status: difyRes.status, body: text }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}

// runtime declaration removed — using default runtime
