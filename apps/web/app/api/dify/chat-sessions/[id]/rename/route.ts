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
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { title } = await req.json()
  if (!title) return NextResponse.json({ error: 'title必須' }, { status: 400 })
  const id = params.id
  if (!id) return NextResponse.json({ error: 'id必須' }, { status: 400 })
  await getPrisma().chatSession.update({ where: { difyId: id }, data: { title } })
  return NextResponse.json({ success: true })
}

export const runtime = 'nodejs'
