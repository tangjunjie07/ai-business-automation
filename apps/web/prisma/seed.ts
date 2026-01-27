import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config } from 'dotenv'
import bcrypt from 'bcryptjs'

config({ path: '../../.env' })

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  // Hash password for super admin
  const superAdminPassword = await bcrypt.hash('superadmin123', 10)
  const adminPassword = await bcrypt.hash('123456', 10)

  // Create super admin user (no tenant)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {},
    create: {
      email: 'superadmin@example.com',
      name: 'Super Administrator',
      password: superAdminPassword,
      role: 'super_admin',
      tenantId: null, // Super admin has no tenant
    },
  })

  const tenant = await prisma.tenant.upsert({
    where: { code: '0001' },
    update: { name: 'テナント1' },
    create: {
      code: '0001',
      name: 'テナント1',
      countryCode: 'JP',
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      name: 'Admin',
      password: adminPassword,
      role: 'admin',
      tenantId: tenant.id,
    },
    create: {
      email: 'admin@gmail.com',
      name: 'Admin',
      password: adminPassword,
      role: 'admin',
      tenantId: tenant.id,
    },
  })

  console.log('Seed data created:', { superAdmin, tenant, adminUser })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
