import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import config from '@/config'

// グローバルPrismaインスタンス
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

// ユーザーの全チャットセッション一覧を返すAPI
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || ''
  if (!userId) return NextResponse.json({ error: 'x-user-id必須' }, { status: 400 })
  const sessions = await getPrisma().chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { difyId: true, title: true, isPinned: true, updatedAt: true },
  })
  return NextResponse.json({ sessions })
}

export const runtime = 'nodejs'
