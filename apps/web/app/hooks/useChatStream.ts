import { useState, useRef } from 'react';
import { UploadedFile } from '@/types/dify';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  message_files?: UploadedFile[];
}


export const useChatStream = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 添付ファイルIDリスト管理
  const [fileIds, setFileIds] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentTask, setCurrentTask] = useState<string>('準備中...');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // onConversationId: conversation_id確定時, onFirstAiMessage: AI初回返答時
  const sendMessage = async (
    query: string,
    conversationId: string | undefined,
    tenantId: string,
    userId?: string,
    onConversationId?: (id: string) => void,
    onFirstAiMessage?: (title?: string, conversationId?: string) => void,
    files?: UploadedFile[]
  ) => {
    setIsLoading(true);
    setCurrentTenantId(tenantId);
    setCurrentUserId(userId || '');
    abortControllerRef.current = new AbortController();
    setMessages(prev => [...prev, { role: 'user', content: query, message_files: files?.filter(f => f.id).map(f => ({ id: f.id, type: f.type, url: f.previewUrl, belongs_to: 'user', name: f.name, size: f.size })) }]);
    let conversationIdSet = false;
    let latestConversationId: string | undefined = conversationId;
    let isFirstMessageEnd = true; // 最初の message_end のみ onFirstAiMessage を呼ぶ
    try {
      // 添付ファイルIDリストも送信
      const response = await fetch('/api/dify/chat-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          query,
          conversation_id: conversationId && conversationId !== 'null' ? conversationId : undefined,
          user: userId,
          files: files?.map(f => ({
            type: f.type || 'image', // デフォルト image
            transfer_method: 'local_file',
            upload_file_id: f.id
          }))
        }),
        signal: abortControllerRef.current.signal
      });
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);
      while (true) {
        // 中止チェック
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Stream aborted by user');
          break;
        }
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.substring(5));
            // task_id 保存
            if (data.task_id && !currentTaskId) {
              setCurrentTaskId(data.task_id);
            }
            // conversation_idがストリームで来たらコールバック
            if (!conversationIdSet && data.conversation_id) {
              conversationIdSet = true;
              latestConversationId = data.conversation_id;
              if (onConversationId) onConversationId(data.conversation_id);
            }
            if (data.event === 'node_started') {
              // ノード開始時にタスク名を更新
              const nodeTitle = data.data?.title || '処理中...';
              setCurrentTask(`${nodeTitle} を実行中...`);
            }
            if (data.event === 'node_finished') {
              // ノード完了時に次のタスクへ
              setCurrentTask('次の処理へ...');
            }
            if (data.event === 'message') {
              assistantMessage += data.answer;
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = assistantMessage;
                return newMsgs;
              });
            }
            // ストリーム終了時のみタイトル取得コールバック
            if (data.event === 'message_end') {
              setCurrentTask('完了');
              // タイトル候補: ユーザー発言＋AI返答の先頭24文字
              let title = "";
              try {
                const userMsg = query || "";
                const aiMsg = assistantMessage;
                title = (userMsg + (aiMsg ? (" " + aiMsg) : "")).slice(0, 24);
              } catch {}
              if (onFirstAiMessage && isFirstMessageEnd) {
                onFirstAiMessage(title, latestConversationId);
                isFirstMessageEnd = false; // 次回以降呼ばない
              }
            }
          } catch (e) {
            // 不正なJSON行は無視
            continue;
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      setIsLoading(false);
      // 送信後はファイルIDリストをクリア
      // setFileIds([]);
    }
  };

  // 添付ファイルID追加
  const addFileId = (id: string) => setFileIds(prev => [...prev, id]);
  const removeFileId = (id: string) => setFileIds(prev => prev.filter(fid => fid !== id));
  // 添付ファイルIDリストをクリア
  const clearFiles = () => setFileIds([]);

  // 履歴取得API最適化: conversationId指定で履歴のみ取得
  const fetchHistory = async (conversationId: string, tenantId: string, userId: string) => {
    const res = await fetch(`/api/dify/messages?conversation_id=${conversationId}&user=${userId}`, {
      headers: {
        'x-tenant-id': tenantId,
        'x-user-id': userId
      }
    });
    const data = await res.json();
    if (Array.isArray(data.data)) {
      // Dify APIレスポンスをチャット形式に変換: 各アイテムからユーザーとアシスタントのメッセージを作成
      const messages: Message[] = data.data.flatMap(item => [
        { role: 'user' as const, content: item.query, message_files: item.message_files },
        { role: 'assistant' as const, content: item.answer }
      ]);
      setMessages(messages);
    }
  };

  const stopGeneration = async () => {
    if (currentTaskId) {
      try {
        await fetch(`/api/dify/chat-messages/${currentTaskId}/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': currentTenantId
          },
          body: JSON.stringify({
            user: currentUserId
          })
        });
      } catch (e) {
        console.error('Stop API failed:', e);
      }
    }
    try {
      abortControllerRef.current?.abort();
    } catch (e) {
      // AbortController の abort はエラーを投げないが、ストリーム中断でコンソール警告が出る場合がある
      console.warn('AbortController abort warning:', e);
    }
    // 中止された場合、部分的に生成されたAIメッセージを削除
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content.trim() === '') {
        // 空のassistantメッセージは削除
        return prev.slice(0, -1);
      }
      return prev;
    });
    setIsLoading(false);
  };

  // 全状態リセット
  const resetAll = () => {
    setMessages([]);
    setFileIds([]);
    setIsLoading(false);
    setCurrentTask('準備中...');
    setCurrentTaskId(null);
  };

  return {
    messages,
    sendMessage,
    isLoading,
    stopGeneration,
    fileIds,
    addFileId,
    removeFileId,
    clearFiles,
    fetchHistory,
    resetAll,
    currentTask,
  };
};
