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

async function createAdminUser() {
  try {
    const hashedPassword = await bcrypt.hash('password', 10)

    const user = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin'
      }
    })

    console.log('Admin user created:', user)
  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()