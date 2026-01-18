import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import config, { getDifyKey } from '@/config'

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
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // 日本語コメント: Dify API仕様に準拠し、DBとDify両方削除
  const conversationId = params.id
  if (!conversationId) {
    return NextResponse.json({ error: 'conversation_id未指定' }, { status: 400 })
  }

  // DBから削除
  try {
    await getPrisma().chatSession.delete({
      where: { difyId: conversationId }
    })
  } catch (e) {
    // 存在しない場合は無視
  }

  // Dify APIから削除
  const DIFY_API_KEY = getDifyKey()
  const DIFY_API_BASE = config.dify.apiBase
  const difyRes = await fetch(`${DIFY_API_BASE.replace(/\/+$/, '')}/v1/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!difyRes.ok) {
    const text = await difyRes.text().catch(() => '')
    return NextResponse.json({ error: 'Dify削除失敗', status: difyRes.status, body: text }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}

export const runtime = 'nodejs'
