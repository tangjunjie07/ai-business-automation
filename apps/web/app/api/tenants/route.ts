import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json({ message: '権限がありません' }, { status: 403 })
    }

    const { tenantCode, tenantName, countryCode, adminEmail, adminName, adminPassword } = await request.json()

    if (!tenantCode || !tenantName || !adminEmail || !adminName || !adminPassword) {
      return NextResponse.json({ message: '必須項目が不足しています' }, { status: 400 })
    }

    // Check if tenant code already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { code: tenantCode }
    })

    if (existingTenant) {
      return NextResponse.json({ message: 'テナントコードが既に存在します' }, { status: 400 })
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingUser) {
      return NextResponse.json({ message: 'メールアドレスが既に使用されています' }, { status: 400 })
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        code: tenantCode,
        name: tenantName,
        countryCode,
      }
    })

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        password: hashedPassword,
        role: 'admin',
        tenantId: tenant.id,
      }
    })

    return NextResponse.json({
      message: 'テナントと管理者を作成しました',
      tenant: { id: tenant.id, code: tenant.code, name: tenant.name },
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    })

  } catch (error) {
    console.error('Tenant creation error:', error)
    return NextResponse.json({ message: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}