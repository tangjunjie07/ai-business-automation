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

// 履歴名変更API
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = params.id;
    
    const { title } = await req.json()
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'titleは必須' }, { status: 400 })
    }
    if (!id) {
      return NextResponse.json({ error: 'id必須' }, { status: 400 })
    }
    
    const prisma = getPrisma()
    const session = await prisma.chatSession.findFirst({ where: { difyId: id } })
    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }
    
    await prisma.chatSession.update({ where: { id: session.id }, data: { title: title.trim() } })
    return NextResponse.json({ success: true })
  } catch (_) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// runtime declaration removed — using default runtime
