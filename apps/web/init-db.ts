import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { config } from 'dotenv'
config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (connectionString) {
  if (process.env.NODE_ENV === 'development') {
    const masked = connectionString.replace(/(:\/\/)(.*@)/, '$1***@')
    console.log('DATABASE_URL:', masked)
  } else {
    console.log('DATABASE_URL is set')
  }
} else {
  console.log('DATABASE_URL is not set')
}
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Initializing database...')

  // Create tables manually using raw SQL since Prisma 7 doesn't support db push with adapter
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Tenant" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "country_code" TEXT NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT,
      "email" TEXT UNIQUE NOT NULL,
      "emailVerified" TIMESTAMP WITH TIME ZONE,
      "image" TEXT,
      "password" TEXT,
      "role" TEXT DEFAULT 'user',
      "tenantId" TEXT REFERENCES "Tenant"("id"),
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      UNIQUE("provider", "providerAccountId")
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT PRIMARY KEY,
      "sessionToken" TEXT UNIQUE NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "expires" TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "VerificationToken" (
      "identifier" TEXT NOT NULL,
      "token" TEXT UNIQUE NOT NULL,
      "expires" TIMESTAMP WITH TIME ZONE NOT NULL,
      UNIQUE("identifier", "token")
    );
  `

  await prisma.$executeRaw`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  `

  console.log('Database initialized successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })