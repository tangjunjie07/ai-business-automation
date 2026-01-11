import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'
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

    // First create a tenant for the super admin (or use existing)
    const tenant = await prisma.tenant.upsert({
      where: { code: 'system-admin' },
      update: {},
      create: {
        code: 'system-admin',
        name: 'System Administration',
        countryCode: 'JP',
      }
    })

    const user = await prisma.user.upsert({
      where: { email: 'superadmin@example.com' },
      update: {},
      create: {
        email: 'superadmin@example.com',
        name: 'Super Administrator',
        password: hashedPassword,
        role: 'super_admin',
        tenantId: tenant.id,
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