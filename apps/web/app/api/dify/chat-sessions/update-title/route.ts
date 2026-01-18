import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import config from '@/config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  adapter: PrismaPg | undefined;
  pool: import('pg').Pool | undefined;
};
function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = config.database.url;
    if (!connectionString) throw new Error('DATABASE_URLが未設定です');
    globalForPrisma.pool = new Pool({ connectionString });
    globalForPrisma.adapter = new PrismaPg(globalForPrisma.pool);
    globalForPrisma.prisma = new PrismaClient({ adapter: globalForPrisma.adapter });
  }
  return globalForPrisma.prisma;
}

// PATCH: /api/dify/chat-sessions/update-title
// body: { conversation_id: string, title: string }
export async function PATCH(req: NextRequest) {
  const { conversation_id, title } = await req.json();
  const tenantId = req.headers.get('x-tenant-id') || '';
  if (!conversation_id || !title || !tenantId) {
    return NextResponse.json({ error: 'conversation_id, title, x-tenant-id必須' }, { status: 400 });
  }
  const prisma = getPrisma();
  // difyId=conversation_id, userId=tenantId
  const session = await prisma.chatSession.findFirst({ where: { difyId: conversation_id, userId: tenantId } });
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  await prisma.chatSession.update({ where: { id: session.id }, data: { title } });
  return NextResponse.json({ ok: true });
}