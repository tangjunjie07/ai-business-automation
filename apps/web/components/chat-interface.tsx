'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Send, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { AnalysisResult, ProgressEvent } from '../types/analysis'

interface Message {
  role: 'user' | 'assistant'
  content: string
  analysisResult?: AnalysisResult
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  isLoading: boolean
}

export default function ChatInterface({ messages, onSendMessage, isLoading }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [progressStep, setProgressStep] = useState(-1)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { data: session } = useSession()

  const progressSteps = [
    '📄 ファイルをアップロード中...',
    '🔍 AI OCRが文字を解析中...',
    '🧠 勘定科目を推論中...',
    '✅ 解析完了！仕訳案を確認してください。'
  ]

  useEffect(() => {
    if (currentJobId) {
      const ws = new WebSocket('ws://localhost:8000/ws/progress')
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ job_id: currentJobId }))
      }

      ws.onmessage = (event) => {
        const data: ProgressEvent = JSON.parse(event.data)
        if (data.event === 'DOC_RECEIVED') {
          setProgressStep(0)
        } else if (data.event === 'OCR_PROCESSING') {
          setProgressStep(1)
        } else if (data.event === 'AI_THINKING') {
          setProgressStep(2)
        } else if (data.event === 'ANALYSIS_COMPLETE') {
          setProgressStep(3)
          setAnalysisResult(data.result || null)
        }
      }

      ws.onclose = () => {
        setProgressStep(-1)
        setCurrentJobId(null)
      }

      return () => {
        ws.close()
      }
    }
  }, [currentJobId])

  useEffect(() => {
    if (analysisResult) {
      const newMessage: Message = {
        role: 'assistant',
        content: '解析が完了しました！以下の内容で仕訳を登録してもよろしいですか？',
        analysisResult
      }
      // Add to messages (assuming onSendMessage can handle assistant messages)
      // For now, we'll assume the parent component handles this
      setProgressStep(-1)
      setCurrentJobId(null)
      setAnalysisResult(null)
    }
  }, [analysisResult])

  const handleFileUpload = async (files: File[]) => {
    if (!session?.user?.tenantId) {
      toast.error('テナント情報が見つかりません。再度ログインしてください。')
      return
    }

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await fetch('http://localhost:8000/api/invoices/upload', {
        method: 'POST',
        headers: {
          'X-Tenant-ID': session.user.tenantId,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      // Handle multiple results
      if (result.results && result.results.length > 0) {
        // Set the first job ID for progress tracking
        setCurrentJobId(result.results[0].invoice_id)
        toast.success(`${files.length}個のファイルがアップロードされました。解析を開始します。`)
      }
    } catch (error) {
      toast.error('アップロードに失敗しました。')
      console.error(error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(Array.from(files))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    onSendMessage(input.trim())
    setInput('')
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AIアシスタント</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border rounded-lg bg-gray-50">
          {messages.length === 0 && progressStep === -1 ? (
            <p className="text-gray-500 text-center">メッセージを開始してください</p>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index}>
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                  {message.analysisResult && (
                    <div className="mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>解析結果: 請求書</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p><strong>勘定科目:</strong> {message.analysisResult.data?.accounting.accountItem} (確信度: {Math.round((message.analysisResult.data?.accounting.confidence || 0) * 100)}%)</p>
                          <p><strong>金額:</strong> ¥{message.analysisResult.data?.totalAmount?.toLocaleString()}</p>
                          <p><strong>プロジェクト:</strong> {message.analysisResult.data?.projectId}</p>
                        </CardContent>
                        <CardFooter>
                          <Button>マネーフォワードへ登録</Button>
                          <Button variant="outline">修正する</Button>
                        </CardFooter>
                      </Card>
                    </div>
                  )}
                </div>
              ))}
              {progressStep >= 0 && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg max-w-md">
                    <p className="text-sm text-gray-600">{progressSteps[progressStep]}</p>
                    <Progress value={(progressStep + 1) / progressSteps.length * 100} className="mt-2" />
                  </div>
                </div>
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
                    AIが考えています...
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || progressStep >= 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            ファイル選択
          </Button>
          <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit(e)}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}