import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import appConfig from '@/config'


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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = request.headers.get('x-tenant-id')
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify user exists under tenant
    const prisma = getPrisma()
    const foundUser = await prisma.user.findFirst({ where: { id: userId, tenantId } })
    if (!foundUser) {
      // Frontend should redirect to registration/login flow when this happens
      return NextResponse.json({ error: 'User not found under tenant' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const message = formData.get('message') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // TODO: persist files to storage and create invoice/ocr records
    // For now return a simulated results array with invoice IDs
    const results = files.map((f, i) => ({
      invoice_id: `inv_${Date.now()}_${i}`,
      fileName: f.name,
      size: f.size,
      type: f.type,
      status: 'processing'
    }))

    return NextResponse.json({
      message: 'Files uploaded successfully',
      uploadedBy: userId,
      tenantId,
      messageText: message,
      results
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
