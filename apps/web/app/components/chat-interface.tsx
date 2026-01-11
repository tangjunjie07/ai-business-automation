
'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Upload, Send, Paperclip } from 'lucide-react'
import { AnalysisResult } from '@/types/analysis'


interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface FileProgress {
  file: File
  jobId: string
  progress: number
  status: string
  message: string
  result?: AnalysisResult
}

export default function ChatInterface() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      // 1. ファイルアップロード（jobIdを取得）
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-tenant-id': session?.user?.tenantId || '',
        },
        body: formData,
      })
      const { jobId } = await response.json()
      // 2. 進捗管理用に追加
      setFileProgresses(prev => [
        ...prev,
        { file, jobId, progress: 0, status: 'DOC_RECEIVED', message: '書類を受け付けました', result: undefined }
      ])

      // 3. WebSocketで進捗受信
      const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000'
      const ws = new window.WebSocket(`${wsBase}/ws/analysis/${jobId}`)
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setFileProgresses(prev => prev.map(fp =>
          fp.jobId === jobId
            ? { ...fp, progress: data.progress, status: data.status, message: data.message, result: data.status === 'COMPLETED' ? { ...data, jobId, status: 'success', data: data.data } : fp.result }
            : fp
        ))
      }
      ws.onerror = () => {
        setFileProgresses(prev => prev.map(fp =>
          fp.jobId === jobId ? { ...fp, status: 'ERROR', message: 'WebSocketエラー', progress: 0 } : fp
        ))
      }
      ws.onclose = () => {}
    } catch (error) {
      alert('ファイルアップロードに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // TODO: AI APIとの連携を実装
      // ここでは仮のレスポンスを返す
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: uploadedFile
            ? `ファイル "${uploadedFile.name}" の内容に基づいて、質問 "${userMessage.content}" に対する回答です。実際のAI処理はまだ実装されていません。`
            : `質問 "${userMessage.content}" に対する回答です。ファイルをアップロードすると、より正確な回答が得られます。`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, aiMessage])
        setIsLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Chat error:', error)
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[24rem]">
      {/* ファイルごとの進捗バー */}
      <div className="mb-4 space-y-2">
        {fileProgresses.map(fp => (
          <div key={fp.jobId} className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-300">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-medium text-sm">{fp.file.name}</span>
              <span className="text-xs text-gray-500">{fp.message}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${fp.progress}%` }} />
            </div>
            {/* 解析完了カード */}
            {fp.status === 'COMPLETED' && fp.result?.data && (
              <Card className="mt-3">
                <CardContent className="space-y-2">
                  <h3 className="font-bold">解析結果: 請求書（{fp.result.data.vendorName}）</h3>
                  <p>勘定科目: <span className="font-bold text-blue-600">{fp.result.data.accounting.accountItem}</span> (確信度: {Math.round(fp.result.data.accounting.confidence * 100)}%)</p>
                  <p>金額: ¥{fp.result.data.totalAmount.toLocaleString()}</p>
                  <p>プロジェクト: {fp.result.data.projectId}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm">マネーフォワードへ登録</Button>
                    <Button size="sm" variant="outline">修正する</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {fp.status === 'ERROR' && (
              <div className="text-red-500 text-sm mt-2">{fp.message}</div>
            )}
          </div>
        ))}
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#071427] rounded-lg mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Paperclip className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>ファイルをアップロードしてチャットを開始してください</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`max-w-xs lg:max-w-md ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white'}`}>
                <CardContent className="p-3">
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString('ja-JP')}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-white">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-sm text-gray-500">AIが考えています...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="flex space-x-2 items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="質問を入力してください..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
