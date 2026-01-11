import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { ROLES } from '../../../../config'

config({ path: '.env.local' })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaPg | undefined
  pool: Pool | undefined
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    globalForPrisma.pool = new Pool({ connectionString })
    globalForPrisma.adapter = new PrismaPg(globalForPrisma.pool)
    globalForPrisma.prisma = new PrismaClient({ adapter: globalForPrisma.adapter })
  }
  return globalForPrisma.prisma
}

// テナント一覧取得 & 新規作成API
export async function GET() {
  const tenants = await getPrisma().tenant.findMany({
    include: {
      users: {
        where: { role: ROLES.ADMIN },
        select: { email: true }
      }
    }
  })
  return NextResponse.json(
    tenants.map(t => ({
      id: t.id,
      name: t.name,
      code: t.code,
      adminEmail: t.users[0]?.email || ''
    }))
  )
}

export async function POST(req: NextRequest) {
  const { name, code, adminEmail, adminPassword } = await req.json()
  if (!name || !code || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: '全て必須です' }, { status: 400 })
  }
  // テナント重複チェック
  const exists = await getPrisma().tenant.findUnique({ where: { code } })
  if (exists) {
    return NextResponse.json({ error: 'テナントコード重複' }, { status: 409 })
  }
  // パスワードハッシュ
  const hashed = await bcrypt.hash(adminPassword, 10)
  // テナント作成
  const tenant = await getPrisma().tenant.create({
    data: {
      name,
      code,
      countryCode: 'JP',
    },
  })
  // 管理者ユーザー作成
    await getPrisma().user.create({
    data: {
      email: adminEmail,
      password: hashed,
      role: ROLES.ADMIN,
      tenantId: tenant.id,
    },
  })
  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    code: tenant.code,
    adminEmail,
  })
}
