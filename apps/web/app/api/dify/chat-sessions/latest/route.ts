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

// 最新のチャットセッション（updated_at降順で1件）を返すAPI
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || ''
  if (!userId) return NextResponse.json({ error: 'x-user-id必須' }, { status: 400 })
  const session = await getPrisma().chatSession.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
  if (!session) return NextResponse.json({ conversation_id: null })
  return NextResponse.json({ conversation_id: session.difyId })
}

export const runtime = 'nodejs'
