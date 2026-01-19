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
  try {
    // ユーザー存在チェック
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }
    // テナント整合性チェック（ユーザーが別テナントに属していたら拒否）
    if (user.tenantId && user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'tenant mismatch' }, { status: 403 });
    }

    // 既存チェックを削除し、upsertを使用
    const session = await prisma.chatSession.upsert({
      where: {
        difyId_userId: {
          difyId: conversation_id,
          userId,
        },
      },
      update: {
        title,
      },
      create: {
        difyId: conversation_id,
        userId,
        title,
        isPinned: false,
      },
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    // 予期しないエラーはログ出力して 500 を返す
    // サーバー側で詳細ログを追いたい場合はここに追加のロギングを入れてください
    console.error('chat-sessions/insert error:', err);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

