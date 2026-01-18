"use client"
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import config, { ROUTES } from '@/config'
import { Sidebar } from '@/components/sidebar'
import { ConfigPanel } from '@/components/config-panel'
import { MessageList } from '@/components/message-list'
import { ChatInput } from '@/components/chat-input'
import { useChatStream } from '@/hooks/useChatStream'

// バックエンドAPI呼び出し時は必ず x-tenant-id ヘッダーを付与（RLS・テナント分離のため必須）

// 履歴型
type ChatSession = { difyId: string; title: string; isPinned: boolean; updatedAt: string };

export default function ChatPage() {
  const { data: session, status } = useSession();
  const { messages, sendMessage, isLoading, stopGeneration, fetchHistory, pinSession, deleteSession, resetAll } = useChatStream();
  const [input, setInput] = useState('');
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [headerTitle, setHeaderTitle] = useState<string>('経理担当AI');
  const [tenantId, setTenantId] = useState<string | null>(null);

  const router = useRouter();
  const didInit = useRef(false);
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (didInit.current) return;
    didInit.current = true;
    const tid = session?.user?.tenantId;
    setTenantId(tid || null);
    if (!tid) {
      router.push(ROUTES.SIGNIN);
      return;
    }
    fetch('/api/dify/chat-sessions/list', {
      headers: {
        'x-tenant-id': tid,
        'x-user-id': session?.user?.id || ''
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
      });
    const lastId = typeof window !== 'undefined' ? localStorage.getItem('last_conversation_id') : null;
    if (lastId) {
      setConversationId(lastId);
    } else {
      fetch('/api/dify/chat-sessions/latest', {
        headers: {
          'x-tenant-id': tid,
          'x-user-id': session?.user?.id || ''
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.conversation_id) {
            setConversationId(data.conversation_id);
            if (typeof window !== 'undefined') localStorage.setItem('last_conversation_id', data.conversation_id);
          }
        });
    }
    // 新規チャット作成イベントリスナー
    const handleNewChat = (e: any) => {
      const newSession = e.detail;
      setSessions(prev => [newSession, ...prev]);
      setConversationId(newSession.difyId);
      if (typeof window !== 'undefined') localStorage.setItem('last_conversation_id', newSession.difyId);
    };
    window.addEventListener('new-chat-created', handleNewChat);
    return () => {
      window.removeEventListener('new-chat-created', handleNewChat);
    };
  }, [session, status]);

  // 送信時: useChatStreamのsendMessageのみを利用
  const handleSend = () => {
    if (!input.trim() || !tenantId) return;
    // 新規チャット直後の初回送信時はconversationIdをリセットして送信
    const isNewChat = !conversationId;
    sendMessage(
      input,
      conversationId && conversationId !== 'null' ? conversationId : undefined,
      tenantId,
      session?.user?.id,
      (cid) => {
        setConversationId(cid);
        if (typeof window !== 'undefined') localStorage.setItem('last_conversation_id', cid);
      },
      async (title, convIdFromStream) => {
        // AI初回返答時: Dify側でタイトル自動生成後、APIで取得し直す
        // Difyタイトル自動生成APIで取得
        let newTitle = title;
        let convId = convIdFromStream || conversationId;
        if (!convId || convId === 'null') {
          convId = typeof window !== 'undefined' ? localStorage.getItem('last_conversation_id') : null;
        }
        if (convId && convId !== 'null' && tenantId) {
          const res = await fetch(`/api/dify/conversations/${convId}/name`, {
            method: 'POST',
            headers: {
              'x-tenant-id': tenantId,
              'x-user-id': session?.user?.id || '',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.name) newTitle = data.name;
          }
          // insertは「AI初回回答・タイトル確定時」のみ発火（新規チャット時のみ）
          await fetch('/api/dify/chat-sessions/insert', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': tenantId,
              'x-user-id': session?.user?.id || ''
            },
            body: JSON.stringify({ conversation_id: convId, title: newTitle }),
          });
        }
        setHeaderTitle(newTitle || '経理担当AI');
        // sessions再取得
        if (tenantId) {
          const res = await fetch('/api/dify/chat-sessions/list', {
            headers: {
              'x-tenant-id': tenantId,
              'x-user-id': session?.user?.id || ''
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.sessions)) setSessions(data.sessions);
          }
        }
        // ヘッダーのタイトルも更新（messagesの先頭にタイトルを挿入するなど、必要に応じて）
        // 必要ならsetStateでヘッダー用タイトルstateを追加し、ここでsetする
      }
    );
    setInput('');
  };

  // サイドバー履歴クリック時: conversation_idを切り替え、チャット内容も取得
  // 履歴クリック時: conversation_id切り替え＋Dify APIから内容取得
  const handleSidebarSelect = async (id: string) => {
    setConversationId(id);
    if (typeof window !== 'undefined') localStorage.setItem('last_conversation_id', id);
    // fetchHistoryで履歴取得
    if (tenantId && session?.user?.id) fetchHistory(id, tenantId, session.user.id);
  };

  if (status === 'loading') {
    return null;
  }
  if (status === 'authenticated' && !tenantId) {
    // リダイレクトはuseEffectで行う
    return null;
  }

  return (
    <div className="flex h-full min-h-0 bg-chatbot-bg text-gray-900 dark:text-gray-100 overflow-hidden relative transition-colors duration-300">
      {/* 左サイドバー: デフォルト非表示、展開時のみDify風シャドウ */}
      <aside className={`transition-all duration-300 ${isLeftOpen ? 'w-64 shadow-lg bg-chatbot-bg z-10 h-full' : 'w-0 h-0 min-h-0'} overflow-hidden relative flex flex-col min-h-0`}>
        {isLeftOpen && (
          <div className="w-64 flex-1 flex flex-col min-h-0">
            <Sidebar
              sessions={sessions}
              messages={messages}
              onSelect={handleSidebarSelect}
              onClose={() => setIsLeftOpen(false)}
              onNewChat={() => {
                // 新規チャットボタン押下時は全状態をリセット
                setConversationId(null);
                setInput('');
                resetAll();
              }}
            />
          </div>
        )}
      </aside>

      {/* 中央チャット */}
      <main className="flex-1 flex flex-col min-h-0 bg-chatbot-bg relative h-full transition-colors duration-300">
        {/* ヘッダー: サイドバー開閉ボタン（常に表示し、状態に応じてトグルする） */}
        <header className="h-14 flex items-center px-4 justify-between bg-chatbot-bg z-10 sticky top-0 transition-colors duration-300">
          <div className={isLeftOpen ? 'hidden' : 'flex items-center gap-2'}>
            {/* 左: サイドバー開閉とコンパクト表示 */}
            {!isLeftOpen && (
              <button
                type="button"
                className="p-2 action-btn action-btn-l"
                onClick={() => setIsLeftOpen(true)}
                aria-label="open-sidebar"
              >
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-[18px] w-[18px]"><path d="M21 3C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H21ZM20 5H4V19H20V5ZM8 7V17H6V7H8Z"></path></svg>
              </button>
            )}

            <div className="mr-1 shrink-0">
              <span className="flex items-center justify-center relative grow-0 shrink-0 overflow-hidden border-[0.5px] border-divider-regular w-10 h-10 text-[24px] rounded-[10px]" style={{background: 'rgb(255, 234, 213)'}}>
                <span>🤖</span>
              </span>
            </div>
            <div className="p-1 text-divider-deep">/</div>
            <div className="inline-block" data-state="closed">
              <div className="flex items-center rounded-lg p-1.5 pl-2 text-text-secondary">
                <div className="system-md-semibold">
                  {headerTitle || '経理担当AI'}
                </div>
              </div>
            </div>
            <div className="flex items-center px-1"><div className="h-[14px] w-px bg-divider-regular"></div></div>
            <div data-state="closed">
              <button
                type="button"
                className="p-2 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  // 新規チャットボタン押下時は全状態をリセット
                  setConversationId(null);
                  setInput('');
                  resetAll();
                }}
                aria-label="new-chat-header"
              >
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M16.7574 2.99678L14.7574 4.99678H5V18.9968H19V9.23943L21 7.23943V19.9968C21 20.5491 20.5523 20.9968 20 20.9968H4C3.44772 20.9968 3 20.5491 3 19.9968V3.99678C3 3.4445 3.44772 2.99678 4 2.99678H16.7574ZM20.4853 2.09729L21.8995 3.5115L12.7071 12.7039L11.2954 12.7064L11.2929 11.2897L20.4853 2.09729Z"></path></svg>
              </button>
            </div>
          </div>

          <div />

          {/* 右: 右サイドパネル開閉トグル（常に表示） */}
          <div>
            {!isRightOpen && (
              <button
                type="button"
                className="p-2 action-btn action-btn-l"
                onClick={() => setIsRightOpen(true)}
                aria-label="open-right-panel"
              >
                <svg width="24" height="24" fill="currentColor" className="h-[18px] w-[18px]" viewBox="0 0 24 24"><path d="M21 3C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H21ZM20 5H4V19H20V5ZM8 7V17H6V7H8Z"></path></svg>
              </button>
            )}
          </div>
        </header>
        {/* メッセージリスト: Dify風 max-w-3xl, mx-auto。チャットエリア内で独立してスクロールし、入力欄は下部にsticky配置 */}
        <div className="flex-1 flex flex-col min-h-0 relative h-full">
          <div className="flex-1 overflow-y-auto pb-40 chat-scrollbar">
            <div className="max-w-3xl mx-auto w-full p-4 md:p-8 space-y-6 min-h-[200px] flex flex-col justify-end">
              <MessageList messages={messages} />
              {messages.length === 0 && (
                <div className="text-center text-gray-400 py-12 select-none">私は高度な専門知識を持つプロの経理担当AIです。
提供された請求書データ（OCR原文と構造化抽出結果）に基づき、最も適切な「勘定科目」と「補助科目」を特定し、仕訳データを作成することができます。</div>
              )}
            </div>
          </div>
          {/* 入力欄: 画面下部にabsolute配置（Dify風） */}
          <div className="absolute bottom-0 left-0 w-full z-50 flex justify-center bg-chat-input-mask dark:bg-[#18181c] pb-4 pointer-events-none transition-colors duration-300">
            <div className="relative mx-auto w-full max-w-[768px] px-4 pointer-events-auto">
              <div className="relative z-10 overflow-hidden rounded-xl border-0 bg-chat-bubble-bg shadow-none">
                <div className="relative px-2 pt-2 border-0">
                  <ChatInput
                    value={input}
                    onChange={setInput}
                    onSend={handleSend}
                    isLoading={isLoading}
                    onStop={stopGeneration}
                    onUpload={() => {}}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 右サイドパネル: 左サイドバー同様にflex配置、入力欄を被らない */}
      <aside className={`transition-all duration-300 ${isRightOpen ? 'w-80 shadow-lg bg-chatbot-bg z-10 h-full' : 'w-0 h-0 min-h-0'} overflow-hidden flex flex-col min-h-0`}>
        {isRightOpen && (
          <div className="w-80 flex-1 flex flex-col min-h-0">
            <ConfigPanel onClose={() => setIsRightOpen(false)} />
          </div>
        )}
      </aside>
    </div>
  );
}
