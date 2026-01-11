import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

const userSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  name: z.string().min(1, '名前は必須です'),
  password: z.string().min(6, 'パスワードは6文字以上です'),
  role: z.enum(['user', 'admin'], '役割はuserまたはadminである必要があります')
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // super_adminはtenantId不要、adminは必須
    if (session.user.role !== 'super_admin' && !session.user.tenantId) {
      return NextResponse.json({ error: 'テナントIDが必要です' }, { status: 400 })
    }

    const body = await request.json()
    const validation = userSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'バリデーションエラー', 
        details: validation.error.issues 
      }, { status: 400 })
    }

    const { email, name, password, role } = validation.data

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'ユーザーが既に存在します' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // super_adminはtenantId: null、adminは自身のtenantId
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        role,
        tenantId: session.user.role === 'super_admin' ? null : session.user.tenantId
      },
      select: { id: true, email: true, name: true, role: true, tenantId: true }
    })

    return NextResponse.json({ 
      message: 'ユーザーを作成しました',
      user 
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}