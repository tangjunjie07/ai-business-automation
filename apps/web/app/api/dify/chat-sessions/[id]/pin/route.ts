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

// ピン留め/解除API
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isPinned } = await req.json()
  if (typeof isPinned !== 'boolean') return NextResponse.json({ error: 'isPinned必須' }, { status: 400 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id必須' }, { status: 400 })
  await getPrisma().chatSession.update({ where: { difyId: id }, data: { isPinned } })
  return NextResponse.json({ success: true })
}

// runtime declaration removed — this route will use the default runtime
