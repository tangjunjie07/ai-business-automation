import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}

// GET /api/tenants - テナント一覧を取得（スーパー管理者のみ）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'super_admin') {
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

    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, domain } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
    }

    // テナント名の重複チェック
    const existingTenant = await getPrisma().tenant.findFirst({
      where: { name }
    })

    if (existingTenant) {
      return NextResponse.json({ error: 'Tenant name already exists' }, { status: 400 })
    }

    // コードの重複チェック（domainが指定されている場合）
    if (domain) {
      const existingCode = await getPrisma().tenant.findFirst({
        where: { code: domain }
      })

      if (existingCode) {
        return NextResponse.json({ error: 'Domain already exists' }, { status: 400 })
      }
    }

    const tenant = await getPrisma().tenant.create({
      data: {
        name,
        code: domain || name.toLowerCase().replace(/\s+/g, '-'), // domainがない場合はnameから生成
        countryCode: 'JP'
      }
    })

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.code,
        createdAt: tenant.createdAt
      }
    })
  } catch (error) {
    console.error('Error creating tenant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}