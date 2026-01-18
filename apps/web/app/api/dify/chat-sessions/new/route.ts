

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import config from '@/config';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const tenantId = session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'テナントIDがありません' }, { status: 400 });
  }
  const prisma = getPrisma();
  // Dify互換のconversation_id（UUID）を生成
  const difyId = randomUUID();
  const newSession = await prisma.chatSession.create({
    data: {
      userId: tenantId,
      difyId,
      title: '新しいチャット',
      isPinned: false,
    },
  });
  return NextResponse.json({ session: newSession });
}
