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

// POST: /api/dify/chat-sessions/insert
// body: { conversation_id: string, title: string }
export async function POST(req: NextRequest) {
  const { conversation_id, title } = await req.json();
  const tenantId = req.headers.get('x-tenant-id') || '';
  const userId = req.headers.get('x-user-id') || '';
  if (!conversation_id || !title || !tenantId || !userId) {
    return NextResponse.json({ error: 'conversation_id, title, x-tenant-id, x-user-id必須' }, { status: 400 });
  }
  const prisma = getPrisma();
  // 既存チェック
  const exists = await prisma.chatSession.findFirst({ where: { difyId: conversation_id, userId } });
  if (exists) {
    return NextResponse.json({ error: 'already exists' }, { status: 409 });
  }
  const session = await prisma.chatSession.create({
    data: {
      difyId: conversation_id,
      userId,
      title,
      isPinned: false,
    },
  });
  return NextResponse.json({ session });
}
