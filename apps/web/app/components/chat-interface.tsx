"use client"
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import useDifySSE from '@/hooks/useDifySSE'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  onAddMessage?: (message: Message) => void
  isLoading: boolean
}

export default function ChatInterface({ messages, onSendMessage, onAddMessage, isLoading }: ChatInterfaceProps) {
  const { data: session } = useSession()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const { send: sseSend, abort: sseAbort } = useDifySSE()
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const c = messagesContainerRef.current
    if (!c) return
    const t = setTimeout(() => c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }), 50)
    return () => clearTimeout(t)
  }, [messages.length, streamingContent])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && pendingFiles.length === 0) return
    if (!session?.user?.tenantId || !session?.user?.id) {
      toast.error('ログイン情報が必要です')
      return
    }
    if (trimmed) onSendMessage(trimmed)
    if (pendingFiles.length > 0 && onAddMessage) onAddMessage({ role: 'user', content: `添付: ${pendingFiles.map(f=>f.name).join(', ')}` })
    if (pendingFiles.length > 0) {
      const form = new FormData()
      pendingFiles.forEach(f => form.append('files', f))
      if (trimmed) form.append('message', trimmed)
      setPendingFiles([])
      try {
        setIsStreaming(true)
        setStreamingContent('')
        const acc = await sseSend(form, {
          tenantId: session.user.tenantId,
          userId: session.user.id,
          onChunk: (chunk) => setStreamingContent(prev => prev + chunk),
        })
        if (onAddMessage) onAddMessage({ role: 'assistant', content: acc || streamingContent })
      } catch (err) {
        const e = err as { name?: string }
        if (e.name === 'AbortError') {
          if (streamingContent && onAddMessage) onAddMessage({ role: 'assistant', content: streamingContent + '（途中まで）' })
          toast('ストリーミングを中止しました')
        } else {
          console.error(err)
          toast.error('送信に失敗しました')
        }
      } finally {
        setIsStreaming(false)
        setInput('')
      }
      return
    }
    try {
      setIsStreaming(true)
      setStreamingContent('')
      const payload = { input: trimmed, tenantId: session.user.tenantId, userId: session.user.id }
      const acc = await sseSend(payload, { tenantId: session.user.tenantId, userId: session.user.id, onChunk: (chunk) => setStreamingContent(prev => prev + chunk) })
      if (onAddMessage) onAddMessage({ role: 'assistant', content: acc || streamingContent })
    } catch (err) {
      const e = err as { name?: string }
      if (e.name === 'AbortError') {
        if (streamingContent && onAddMessage) onAddMessage({ role: 'assistant', content: streamingContent + '（途中まで）' })
        toast('ストリーミングを中止しました')
      } else {
        console.error('send failed', err)
        toast.error('送信に失敗しました')
      }
    } finally {
      setIsStreaming(false)
      setInput('')
    }
  }

  const handleAbort = () => {
    sseAbort()
    setIsStreaming(false)
  }

  // Dify風メッセージバブル
  const renderBubble = (m: Message, i: number) => (
    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
      <div className={`rounded-xl px-4 py-2 max-w-[80%] whitespace-pre-line shadow ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-chat-bubble-bg text-text-primary'}`}>
        {m.content}
      </div>
    </div>
  )

  return (
    <div className="relative w-full">
      <div className="flex flex-col h-[60vh] min-h-[400px] bg-chat-bubble-bg rounded-xl border border-components-panel-border shadow-md overflow-hidden">
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !isStreaming ? (
            <p className="text-center text-gray-400">ここにAIの応答が表示されます</p>
          ) : (
            <>
              {messages.map(renderBubble)}
              {isStreaming && streamingContent && renderBubble({ role: 'assistant', content: streamingContent }, -1)}
            </>
          )}
        </div>
      </div>
      {/* 入力欄 下部固定 Dify風 */}
      <form
        className="absolute left-0 right-0 bottom-0 px-4 py-3 bg-chatbot-bg border-t border-components-panel-border flex gap-2 items-center"
        style={{ borderRadius: '0 0 1rem 1rem' }}
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          className="flex-1 rounded-lg border border-components-panel-border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="ai-business-automation と話す"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isStreaming || isLoading}
        />
        <input
          type="file"
          multiple
          className="hidden"
          id="chat-file-upload"
          onChange={e => {
            if (!e.target.files) return
            setPendingFiles(Array.from(e.target.files))
            toast.success(`${e.target.files.length}個を添付しました`)
          }}
        />
        <label htmlFor="chat-file-upload" className="cursor-pointer px-3 py-2 rounded-lg bg-chat-input-mask hover:bg-state-base-hover border border-components-panel-border text-text-tertiary hover:text-text-secondary">
          📎
        </label>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-all"
          disabled={isStreaming || isLoading || !input.trim()}
        >送信</button>
        {isStreaming && (
          <button type="button" className="ml-2 text-sm text-gray-500" onClick={handleAbort}>中止</button>
        )}
      </form>
    </div>
  )
}
