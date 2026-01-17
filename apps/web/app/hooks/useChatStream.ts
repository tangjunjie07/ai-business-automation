import { useState, useRef } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const useChatStream = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (query: string, conversationId?: string) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    try {
      const response = await fetch('/api/dify/chat-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, conversation_id: conversationId }),
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
          const data = JSON.parse(line.substring(5));
          if (data.event === 'message') {
            assistantMessage += data.answer;
            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].content = assistantMessage;
              return newMsgs;
            });
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  return { messages, sendMessage, isLoading, stopGeneration };
};
