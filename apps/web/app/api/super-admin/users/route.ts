import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import appConfig from '@/config'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaPg | undefined
  pool: import('pg').Pool | undefined
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = appConfig.database.url
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    globalForPrisma.pool = new Pool({ connectionString })
    globalForPrisma.adapter = new PrismaPg(globalForPrisma.pool)
    globalForPrisma.prisma = new PrismaClient({ adapter: globalForPrisma.adapter })
  }
  return globalForPrisma.prisma
}

// 全ユーザー一覧取得API
export async function GET() {
  const users = await getPrisma().user.findMany({
    include: {
      tenant: true
    }
  })
  return NextResponse.json(
    users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      tenantCode: u.tenant?.code || '',
      tenantName: u.tenant?.name || ''
    }))
  )
}
