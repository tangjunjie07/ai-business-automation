import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

// Load environment variables from apps/web/.env.local
dotenv.config({ path: './apps/web/.env.local' })

const connectionString = process.env.DATABASE_URL
console.log('DATABASE_URL:', connectionString)

if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function createSuperAdminUser() {
  try {
    const hashedPassword = await bcrypt.hash('superadmin123', 10)
    console.log('Generated bcrypt hash for superadmin123:', hashedPassword)
    // hashと照合テスト
    const test = await bcrypt.compare('superadmin123', hashedPassword)
    console.log('Hash compare test (should be true):', test)

    // code: 'system-admin' のテナントが既に存在する場合はidを'0'にupdate、なければ新規作成
    let tenant = await prisma.tenant.findUnique({ where: { code: 'system-admin' } })
    if (tenant) {
      if (tenant.id !== '0') {
        // 既存テナントのidを'0'に変更
        await prisma.tenant.update({ where: { code: 'system-admin' }, data: { id: '0' } })
        tenant = await prisma.tenant.findUnique({ where: { code: 'system-admin' } })
      }
    } else {
      tenant = await prisma.tenant.create({
        data: {
          id: '0',
          code: 'system-admin',
          name: 'System Administration',
          countryCode: 'JP',
        }
      })
    }

    const user = await prisma.user.upsert({
      where: { email: 'superadmin@example.com' },
      update: {
        password: hashedPassword,
        tenantId: '0',
      },
      create: {
        email: 'superadmin@example.com',
        name: 'Super Administrator',
        password: hashedPassword,
        role: 'super_admin',
        tenantId: '0',
      }
    })

    console.log('Super admin user created:', user)
    console.log('Login credentials:')
    console.log('Email: superadmin@example.com')
    console.log('Password: superadmin123')
  } catch (error) {
    console.error('Error creating super admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createSuperAdminUser()