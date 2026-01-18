import { useState, useRef } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}


export const useChatStream = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 添付ファイルIDリスト管理
  const [fileIds, setFileIds] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // onConversationId: conversation_id確定時, onFirstAiMessage: AI初回返答時
  const sendMessage = async (
    query: string,
    conversationId: string | undefined,
    tenantId: string,
    userId?: string,
    onConversationId?: (id: string) => void,
    onFirstAiMessage?: (title?: string, conversationId?: string) => void
  ) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    let conversationIdSet = false;
    let latestConversationId: string | undefined = conversationId;
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
          inputs: { files: fileIds }
        }),
        signal: abortControllerRef.current.signal
      });
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.substring(5));
            // conversation_idがストリームで来たらコールバック
            if (!conversationIdSet && data.conversation_id) {
              conversationIdSet = true;
              latestConversationId = data.conversation_id;
              if (onConversationId) onConversationId(data.conversation_id);
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
              // タイトル候補: ユーザー発言＋AI返答の先頭24文字
              let title = "";
              try {
                const userMsg = query || "";
                const aiMsg = assistantMessage;
                title = (userMsg + (aiMsg ? (" " + aiMsg) : "")).slice(0, 24);
              } catch {}
              if (onFirstAiMessage) onFirstAiMessage(title, latestConversationId);
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
      setFileIds([]);
    }
  };

  // 添付ファイルID追加
  const addFileId = (id: string) => setFileIds(prev => [...prev, id]);
  // 添付ファイルIDリストをクリア
  const clearFiles = () => setFileIds([]);

  // 履歴取得API最適化: conversationId指定で履歴のみ取得
  const fetchHistory = async (conversationId: string, tenantId: string, userId: string) => {
    const res = await fetch(`/api/dify/messages?conversation_id=${conversationId}`, {
      headers: {
        'x-tenant-id': tenantId,
        'x-user-id': userId
      }
    });
    const data = await res.json();
    if (Array.isArray(data.messages)) setMessages(data.messages);
  };

  // ピン留めAPI連携
  const pinSession = async (sessionId: string, tenantId: string) => {
    await fetch(`/api/dify/chat-sessions/${sessionId}/pin`, {
      method: 'POST',
      headers: { 'x-tenant-id': tenantId }
    });
  };

  // 削除API連携
  const deleteSession = async (sessionId: string, tenantId: string) => {
    await fetch(`/api/dify/chat-sessions/${sessionId}/delete`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': tenantId }
    });
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  // 全状態リセット
  const resetAll = () => {
    setMessages([]);
    setFileIds([]);
    setIsLoading(false);
  };

  return {
    messages,
    sendMessage,
    isLoading,
    stopGeneration,
    fileIds,
    addFileId,
    clearFiles,
    fetchHistory,
    pinSession,
    deleteSession,
    resetAll,
  };
};
