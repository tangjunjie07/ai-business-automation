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

// POST: /api/dify/db/chat-sessions/insert-batch
// body: { conversations: Array<{conversation_id: string, title: string}> }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const tenantId = req.headers.get('x-tenant-id') || '';
  const userId = req.headers.get('x-user-id') || '';
  if (!tenantId || !userId) {
    return NextResponse.json({ error: 'x-tenant-id, x-user-id必須' }, { status: 400 });
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

    const conversations = body.conversations;
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ error: 'conversations必須' }, { status: 400 });
    }

    // 既存チェック（一括で）
    const existingIds = await prisma.chatSession.findMany({
      where: { difyId: { in: conversations.map(c => c.conversation_id) }, userId },
      select: { difyId: true }
    });
    const existingSet = new Set(existingIds.map(e => e.difyId));
    const toInsert = conversations.filter(c => !existingSet.has(c.conversation_id));

    if (toInsert.length === 0) {
      return NextResponse.json({ message: 'no new sessions to insert' }, { status: 200 });
    }

    // 一括挿入
    await prisma.chatSession.createMany({
      data: toInsert.map(c => ({
        difyId: c.conversation_id,
        userId,
        title: c.title,
        isPinned: false,
      })),
    });

    return NextResponse.json({ inserted: toInsert.length }, { status: 201 });
  } catch (err) {
    // 予期しないエラーはログ出力して 500 を返す
    // サーバー側で詳細ログを追いたい場合はここに追加のロギングを入れてください
    console.error('db/chat-sessions/insert-batch error:', err);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}