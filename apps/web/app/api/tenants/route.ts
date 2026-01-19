import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient, Tenant } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import appConfig, { ROLES } from '@/config'

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

// GET /api/tenants - テナント一覧を取得（スーパー管理者のみ）
export async function GET(_: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenants = await getPrisma().tenant.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedTenants = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.code, // codeをdomainとして返す
      createdAt: tenant.createdAt,
      userCount: tenant._count.users
    }))

    return NextResponse.json({ tenants: formattedTenants })
  } catch (error) {
    console.error('Error fetching tenants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tenants - 新規テナント作成（スーパー管理者のみ）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, domain, adminEmail, adminName, adminPassword } = body

    if (!name) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
    }

    // If admin info provided, require necessary fields
    if (adminEmail && (!adminName || !adminPassword)) {
      return NextResponse.json({ error: 'Admin name and password are required when adminEmail is provided' }, { status: 400 })
    }

    const prisma = getPrisma()

    try {
      const result = await prisma.$transaction(async (tx) => {
        // テナント名の重複チェック
        const existingTenant = await tx.tenant.findFirst({ where: { name } })
        if (existingTenant) {
          throw new Error('Tenant name already exists')
        }

        // コードの重複チェック（domainが指定されている場合）
        if (domain) {
          const existingCode = await tx.tenant.findFirst({ where: { code: domain } })
          if (existingCode) {
            throw new Error('Domain already exists')
          }
        }

        // 管理者メールの重複チェック（グローバル）
        if (adminEmail) {
          const existingUser = await tx.user.findUnique({ where: { email: adminEmail } })
          if (existingUser) {
            throw new Error('Admin email already exists')
          }
        }

        const tenant = await tx.tenant.create({
          data: {
            name,
            code: domain || name.toLowerCase().replace(/\s+/g, '-'),
            countryCode: 'JP'
          }
        })

        let adminUser = null
        if (adminEmail) {
          const hashed = await bcrypt.hash(adminPassword, 10)
          adminUser = await tx.user.create({
            data: {
              email: adminEmail,
              name: adminName || null,
              password: hashed,
              role: ROLES.ADMIN,
              tenantId: tenant.id
            },
            select: { id: true, email: true, name: true, role: true, tenantId: true }
          })
        }

        return { tenant, adminUser }
      })

      const { tenant, adminUser } = result as { tenant: Tenant; adminUser: unknown }

      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          domain: tenant.code,
          createdAt: tenant.createdAt
        },
        admin: adminUser || null
      })
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Internal server error'
      if (msg.includes('already exists')) {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      console.error('Error creating tenant and admin:', e)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error creating tenant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
