import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import config from '@/config'

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

// GET: /api/dify/db/conversations
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || ''
  if (!userId) return NextResponse.json({ error: 'x-user-id必須' }, { status: 400 })
  const sessions = await getPrisma().chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { difyId: true, title: true, isPinned: true, updatedAt: true },
  })
  // chatSessionのdifyIdをidとして返す
  const data = sessions.map(s => ({ id: s.difyId, ...s }))
  return NextResponse.json({ data })
}

// DELETE: /api/dify/db/conversations
// body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || ''
  if (!userId) return NextResponse.json({ error: 'x-user-id必須' }, { status: 400 })
  let ids: string[] = []
  try {
    const body = await req.json()
    ids = Array.isArray(body.ids) ? body.ids : []
  } catch {}
  if (!ids.length) {
    return NextResponse.json({ error: 'ids必須' }, { status: 400 })
  }
  try {
    await getPrisma().chatSession.deleteMany({
    where: {
        difyId: { in: ids },
        ...(userId ? { userId } : {}),
    },
    });
    return NextResponse.json({ result: 'success' })
  } catch (e) {
    return NextResponse.json({ error: 'DB削除失敗', detail: String(e) }, { status: 500 })
  }
}
