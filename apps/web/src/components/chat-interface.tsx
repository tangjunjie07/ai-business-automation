'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, Send, Paperclip } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatInterface() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-tenant-id': session?.user?.tenantId || '',
        },
        body: formData,
      })

      if (response.ok) {
        setUploadedFile(file)
        // ファイルアップロード成功メッセージを追加
        const uploadMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `ファイル "${file.name}" をアップロードしました。分析を開始します。`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, uploadMessage])
      } else {
        const error = await response.json()
        alert(error.error || 'ファイルアップロードに失敗しました')
      }
    } catch (error) {
      console.error('Upload error:', error)
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
    <div className="flex flex-col h-96">
      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg mb-4">
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

      {/* アップロード済みファイル表示 */}
      {uploadedFile && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            📎 {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
          </p>
        </div>
      )}

      {/* 入力エリア */}
      <div className="flex space-x-2">
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