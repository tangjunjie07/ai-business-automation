
"use client"

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card'
import { Progress } from './ui/progress'
import { Send, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { AnalysisResult, ProgressEvent } from '@/types/analysis'
import type { ChatResponse as IngestChatResponse, Message as IngestMessage } from '@/types/ingestion'
import { network } from '@/config'


interface Message {
  role: 'user' | 'assistant'
  content: string
  analysisResult?: AnalysisResult
  suggestions?: string[]
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  onAddMessage?: (message: Message) => void
  isLoading: boolean
}

export default function ChatInterface({ messages, onSendMessage, onAddMessage, isLoading }: ChatInterfaceProps) {
  const API_BASE = network.apiBase || 'http://localhost:8000'
  const [input, setInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [progressStep, setProgressStep] = useState(-1)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [activeJobs, setActiveJobs] = useState<{ id: string; name?: string; progress: number }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const wsMap = useRef<Record<string, WebSocket | null>>({})
  const wsRetry = useRef<Record<string, number>>({})
  const activeJobsRef = useRef(activeJobs)
  const MAX_WS_RETRIES = 5
  const WS_BACKOFF_BASE_MS = 500
  const { data: session } = useSession()

  // Helper: safely extract file name from various possible field names
  const getFileName = (d: any): string | null => {
    if (!d) return null
    // prefer explicit fileName/file_name, then fall back to URL-derived filename
    const candidates = [d.fileName, d.file_name, d.fileName?.toString(), d.file_name?.toString(), d.fileName?.toString(), d.file_name?.toString(), d.fileUrl, d.file_url]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) return c
    }
    // try to derive from file_url / fileUrl if present
    const url = d.file_url || d.fileUrl
    if (typeof url === 'string' && url.includes('/')) {
      try {
        const parts = url.split('/')
        return parts[parts.length - 1]
      } catch (_) {
        return url
      }
    }
    return null
  }

  useEffect(() => {
    activeJobsRef.current = activeJobs
  }, [activeJobs])

  // Auto-scroll to keep latest messages visible with a small offset
  useEffect(() => {
    const c = messagesContainerRef.current
    if (!c) return
    // allow DOM to update
    const t = setTimeout(() => {
      const offset = 40 // pixels to keep some space at bottom
      const target = c.scrollHeight - c.clientHeight - offset
      c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(t)
  }, [messages.length, activeJobs.length])

  const progressSteps = [
    '📄 ファイルをアップロード中...',
    '🔍 AI OCRが文字を解析中...',
    '🧠 勘定科目を推論中...',
    '✅ 解析完了！仕訳案を確認してください。'
  ]

  // For multi-job support, open one WS connection per job and track in wsMap
  useEffect(() => {
    return () => {
      // cleanup all websockets on unmount
      for (const k of Object.keys(wsMap.current)) {
        try {
          wsMap.current[k]?.close()
        } catch (_) {}
      }
      wsMap.current = {}
    }
  }, [])

  useEffect(() => {
    if (analysisResult) {
      const newMessage: Message = {
        role: 'assistant',
        content: '解析が完了しました！以下の内容で仕訳を登録してもよろしいですか？',
        analysisResult
      }
      if (typeof onAddMessage === 'function') {
        onAddMessage(newMessage)
      }
      setProgressStep(-1)
      setCurrentJobId(null)
      setAnalysisResult(null)
    }
  }, [analysisResult, onAddMessage])

  const handleFileUpload = async (files: File[]) => {
    // 選択時は即時送信せず、一時保持する
    setPendingFiles(files)
    toast.success(`${files.length}個を添付しました。送信時に解析を開始します。`)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(Array.from(files))
      // reset input so same file can be selected again if needed
      e.currentTarget.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && pendingFiles.length === 0) return

    // まずローカルにユーザメッセージを追加
    if (trimmed) {
      onSendMessage(trimmed)
    }

    // 表示用: 添付ファイル情報をチャットに追加
    if (pendingFiles.length > 0 && typeof onAddMessage === 'function') {
      const names = pendingFiles.map(f => f.name).join(', ')
      onAddMessage({ role: 'user', content: `添付: ${names}` })
    }

    // セッションチェック
    if (!session?.user?.tenantId || !session?.user?.id) {
      toast.error('ユーザー/テナント情報が見つかりません。再度ログインしてください。')
      return
    }

    // 添付ファイルがある場合は、添付をコピーして UI を即時クリアしてから送信する
    if (pendingFiles.length > 0) {
      const filesToSend = pendingFiles.slice()
      // UI 側は即時クリア（送信はバックグラウンドで継続）
      setPendingFiles([])

      const formData = new FormData()
      filesToSend.forEach(f => formData.append('files', f))
      if (trimmed) formData.append('message', trimmed)

      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
              'X-Tenant-ID': session.user.tenantId,
              'X-USER-ID': session.user.id,
            },
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'upload failed' }))
            throw new Error(err?.error || 'upload failed')
          }

          const result = await res.json() as IngestChatResponse
          // テスト用: サーバーからのレスポンスをコンソールに出力
          console.log('[HTTP] /chat response (files):', result)

          // 型付きレスポンスとして扱う
          const messagesArray: IngestMessage[] = result?.messages || []
          // Prefer explicit invoiceIds array from new ack-style response
          const invoiceIdsFromAck: string[] | undefined = (result && (result.invoiceIds || result.invoice_ids))
          const firstInvoiceId: string | null = invoiceIdsFromAck && invoiceIdsFromAck.length > 0
            ? invoiceIdsFromAck[0]
            : (messagesArray.length > 0
              ? (messagesArray[0].invoiceData?.invoice_id || messagesArray[0].id || messagesArray[0].invoice_id || null)
              : null)

          if (invoiceIdsFromAck && invoiceIdsFromAck.length > 0) {
            // build job entries from ack-provided invoiceIds
            const jobEntries = invoiceIdsFromAck.map((id, i) => ({ id, name: filesToSend[i]?.name, progress: 10 }))
            if (jobEntries.length > 0) {
              setActiveJobs(prev => [...prev, ...jobEntries])
              toast.success(`${jobEntries.length}個のファイルを送信しました。解析を開始します。`)
              const wsBase = API_BASE.replace(/^http/, 'ws')
              jobEntries.forEach(job => {
                const createWsForJob = (jobId: string) => {
                  try {
                    const ws = new WebSocket(`${wsBase}/ws/progress/${jobId}`)
                    wsMap.current[jobId] = ws

                    ws.onopen = () => { wsRetry.current[jobId] = 0 }

                    ws.onmessage = (event) => {
                      const data: ProgressEvent = JSON.parse(event.data)
                      // ignore keepalive pings or malformed messages
                      if ((data as any).type === 'ping') return
                      if (!data.event) return

                      console.log('[WS] progress for', jobId, data)
                      const mapEventToProgress = (ev?: string) => {
                        if (!ev) return null
                        if (ev === 'DOC_RECEIVED') return 10
                        if (ev === 'OCR_PROCESSING') return 40
                        if (ev === 'AI_THINKING') return 70
                        if (ev === 'ANALYSIS_COMPLETE') return 100
                        if (ev === 'CANCELED') return 0
                        return null
                      }

                      const p = mapEventToProgress(data.event)
                      if (p !== null) {
                        setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, progress: p } : j))
                      }

                      if (data.event === 'ANALYSIS_COMPLETE') {
                        if (data.result) {
                          const analysis: AnalysisResult = data.result as AnalysisResult
                          const assistantMessage: Message = {
                            role: 'assistant',
                            content: '解析が完了しました（非同期結果）',
                            analysisResult: analysis
                          }
                          if (typeof onAddMessage === 'function') onAddMessage(assistantMessage)
                        }
                        setTimeout(() => setActiveJobs(prev => prev.filter(j => j.id !== jobId)), 600)
                        try { ws.close() } catch (_) {}
                        delete wsMap.current[jobId]
                        delete wsRetry.current[jobId]
                      }

                      if (data.event === 'CANCELED') {
                        setActiveJobs(prev => prev.filter(j => j.id !== jobId))
                        try { ws.close() } catch (_) {}
                        delete wsMap.current[jobId]
                        delete wsRetry.current[jobId]
                        if (typeof onAddMessage === 'function') {
                          onAddMessage({ role: 'assistant', content: 'ジョブはキャンセルされました。' })
                        }
                      }
                    }

                    ws.onerror = (err) => { console.warn('WS error for job', jobId, err) }
                    ws.onclose = () => {
                      const retries = wsRetry.current[jobId] || 0
                      if (retries >= MAX_WS_RETRIES) { delete wsMap.current[jobId]; return }
                      wsRetry.current[jobId] = retries + 1
                      const backoff = WS_BACKOFF_BASE_MS * Math.pow(2, retries)
                      setTimeout(() => { const stillActive = activeJobsRef.current.find(j => j.id === jobId); if (stillActive) createWsForJob(jobId) }, backoff)
                    }
                  } catch (e) { console.error('WS connection failed for job', job.id, e) }
                }
                createWsForJob(job.id)
              })
            }
            // skip legacy handling below
            // proceed to process any immediate messages if present
          } else if (firstInvoiceId) {
            // 複数ジョブ対応: レスポンスから各ジョブIDを取得して activeJobs を追加する
            const messagesArrayTyped: IngestMessage[] = messagesArray as IngestMessage[]
            const jobEntries = messagesArrayTyped.map((m: any, i: number) => {
              const id = m.invoiceData?.invoice_id || m.id || m.invoice_id || null
              const name = filesToSend[i]?.name
              return id ? { id, name, progress: 10 } : null
            }).filter(Boolean) as { id: string; name?: string; progress: number }[]

            if (jobEntries.length > 0) {
              setActiveJobs(prev => [...prev, ...jobEntries])
              toast.success(`${jobEntries.length}個のファイルを送信しました。解析を開始します。`)
              // 各ジョブごとに WebSocket を開いて進捗を受け取る
              const wsBase = API_BASE.replace(/^http/, 'ws')
              jobEntries.forEach(job => {
                const createWsForJob = (jobId: string) => {
                    try {
                    const ws = new WebSocket(`${wsBase}/ws/progress/${jobId}`)
                    wsMap.current[jobId] = ws

                    ws.onopen = () => {
                      wsRetry.current[jobId] = 0
                    }

                    ws.onmessage = (event) => {
                      const data: ProgressEvent = JSON.parse(event.data)
                      console.log('[WS] progress for', jobId, data)
                      const mapEventToProgress = (ev?: string) => {
                        if (!ev) return 0
                        if (ev === 'DOC_RECEIVED') return 10
                        if (ev === 'OCR_PROCESSING') return 40
                        if (ev === 'AI_THINKING') return 70
                        if (ev === 'ANALYSIS_COMPLETE') return 100
                        if (ev === 'CANCELED') return 0
                        return 0
                      }
                      const p = mapEventToProgress(data.event)
                      setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, progress: p } : j))

                      if (data.event === 'ANALYSIS_COMPLETE') {
                        if (data.result) {
                          const analysis: AnalysisResult = data.result as AnalysisResult
                          const assistantMessage: Message = {
                            role: 'assistant',
                            content: '解析が完了しました（非同期結果）',
                            analysisResult: analysis
                          }
                          if (typeof onAddMessage === 'function') onAddMessage(assistantMessage)
                        }
                        setTimeout(() => setActiveJobs(prev => prev.filter(j => j.id !== jobId)), 600)
                        try { ws.close() } catch (_) {}
                        delete wsMap.current[jobId]
                        delete wsRetry.current[jobId]
                      }

                      if (data.event === 'CANCELED') {
                        // server-side cancel: remove job
                        setActiveJobs(prev => prev.filter(j => j.id !== jobId))
                        try { ws.close() } catch (_) {}
                        delete wsMap.current[jobId]
                        delete wsRetry.current[jobId]
                        if (typeof onAddMessage === 'function') {
                          onAddMessage({ role: 'assistant', content: 'ジョブはキャンセルされました。' })
                        }
                      }
                    }

                    ws.onerror = (err) => {
                      console.warn('WS error for job', jobId, err)
                    }

                    ws.onclose = () => {
                      const retries = wsRetry.current[jobId] || 0
                      if (retries >= MAX_WS_RETRIES) {
                        console.warn('Max WS retries reached for', jobId)
                        delete wsMap.current[jobId]
                        return
                      }
                      wsRetry.current[jobId] = retries + 1
                      const backoff = WS_BACKOFF_BASE_MS * Math.pow(2, retries)
                      setTimeout(() => {
                        // only reconnect if job still active
                        const stillActive = activeJobsRef.current.find(j => j.id === jobId)
                        if (stillActive) createWsForJob(jobId)
                      }, backoff)
                    }
                  } catch (e) {
                    console.error('WS connection failed for job', job.id, e)
                  }
                }

                createWsForJob(job.id)
              })
            } else {
              setCurrentJobId(firstInvoiceId)
              toast.success(`${filesToSend.length}個のファイルを送信しました。解析を開始します。`)
            }
          } else {
            toast.success('ファイルを送信しました。')
          }
          // 追加: サーバーが返した messages / results / 配列を即時にチャットへ反映
          try {
            const messagesArray = Array.isArray(result) ? result : (result.results || result.messages || [])
            if (messagesArray && messagesArray.length > 0 && typeof onAddMessage === 'function') {
              for (const m of messagesArray) {
                const invoiceData = m.invoiceData || m.ocr_result || m
                if (invoiceData) {
                  const o = invoiceData.ocr_result || invoiceData
                  const analysis: AnalysisResult = {
                    data: {
                      accounting: {
                        accountItem: o.inferred_accounts?.[0]?.accountItem || o.inferred_accounts?.[0]?.description || '不明',
                        confidence: o.inferred_accounts?.[0]?.confidence || 0
                      },
                      totalAmount: o.inferred_accounts?.[0]?.amount || o.totalAmount || null,
                      projectId: o.projectId || null
                    }
                  }
                  const assistantMessage: Message = {
                    role: 'assistant',
                    content: '解析が完了しました（同期結果）',
                    analysisResult: analysis
                  }
                  onAddMessage(assistantMessage)
                }
              }
            }
          } catch (e) {
            console.error('Failed to apply immediate OCR/AI results to chat:', e)
          }
        } catch (err) {
          console.error(err)
          toast.error('アップロードに失敗しました。')
        } finally {
          // 常に入力をクリア
          setInput('')
        }
      })()
    } else {
      // ファイルなしのメッセージ単体送信: backend に message のみ送信して AI を呼び出す
      const formData = new FormData()
      formData.append('message', trimmed)

      ;(async () => {
        try {
          const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
              'X-Tenant-ID': session.user.tenantId,
              'X-USER-ID': session.user.id,
            },
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'send failed' }))
            throw new Error(err?.error || 'send failed')
          }

          const result = await res.json() as IngestChatResponse
          // テスト用: サーバーからのレスポンスをコンソールに出力
          console.log('[HTTP] /chat response (message):', result)
          // テキスト送信では wrapper を期待
          if (result.results && result.results.length > 0) {
            // テキストのみの結果が返る場合の処理（必要に応じてハンドリング）
            toast.success('メッセージを送信しました（AI 処理を開始）')
          } else {
            toast.success('メッセージを送信しました。')
          }
          // 追加: メッセージ送信のレスポンスに即時推論結果が含まれる場合はチャットへ反映
          try {
            const messagesArray: IngestMessage[] = result.results || result.messages || []
            if (messagesArray.length > 0 && typeof onAddMessage === 'function') {
              for (const m of messagesArray) {
                if (m.inferred || m.invoiceData) {
                  const inferred = m.inferred || m.invoiceData?.inferred
                  const analysis: AnalysisResult = { data: inferred }
                  const assistantMessage: Message = {
                    role: 'assistant',
                    content: 'AI 推論結果です（同期）',
                    analysisResult: analysis
                  }
                  onAddMessage(assistantMessage)
                }
              }
            }
          } catch (e) {
            console.error('Failed to apply immediate AI results to chat:', e)
          }
        } catch (err) {
          console.error(err)
          toast.error('メッセージ送信に失敗しました。')
        } finally {
          setInput('')
        }
      })()
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const cancelJob = async (jobId: string) => {
    // optimistic UI: remove job locally and close WS
    try {
      const ws = wsMap.current[jobId]
      try { ws?.close() } catch (_) {}
      delete wsMap.current[jobId]
    } catch (e) {
      console.warn('Error closing ws for cancel', e)
    }

    setActiveJobs(prev => prev.filter(j => j.id !== jobId))
    try { delete wsRetry.current[jobId] } catch (_) {}

    // call backend cancel API (may not exist yet)
    try {
      const res = await fetch(`${API_BASE}/chat/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'X-Tenant-ID': session?.user?.tenantId || '',
          'X-USER-ID': session?.user?.id || ''
        }
      })
      if (!res.ok) {
        const err = await res.text().catch(() => 'cancel failed')
        toast.error(`キャンセルリクエストに失敗しました: ${err}`)
        return
      }
      toast.success('ジョブをキャンセルしました。')
    } catch (e) {
      console.error('Cancel request failed', e)
      toast.error('キャンセルリクエストに失敗しました。')
    }
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AIアシスタント</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border rounded-lg bg-gray-50 chat-scrollbar min-h-0">
          {messages.length === 0 && progressStep === -1 ? (
            <p className="text-gray-500 text-center">メッセージを開始してください</p>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index}>
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-500 text-white">
                        {message.content}
                      </div>
                    ) : (
                      <Card className="max-w-xs lg:max-w-md">
                        <CardContent className="p-3">
                          <p className="text-sm text-gray-700">{message.content}</p>
                          {message.suggestions && message.suggestions.length > 0 && (
                            <div className="mt-3 flex gap-2">
                              {message.suggestions.map((s, i) => (
                                <button
                                  key={i}
                                  className="text-xs border border-blue-400 text-blue-500 rounded-full px-2 py-1"
                                  onClick={() => onSendMessage(s)}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  {message.analysisResult && (() => {
                    const fileName = getFileName(message.analysisResult.data)
                    return (
                      <div className="mt-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>解析結果: {fileName || '請求書'}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p><strong>勘定科目:</strong> {message.analysisResult.data?.accounting.accountItem} (確信度: {Math.round((message.analysisResult.data?.accounting.confidence || 0) * 100)}%)</p>
                            <p><strong>金額:</strong> ¥{message.analysisResult.data?.totalAmount?.toLocaleString()}</p>
                            <p><strong>プロジェクト:</strong> {message.analysisResult.data?.projectId}</p>
                          </CardContent>
                          <CardFooter className="flex gap-2">
                            <Button>マネーフォワードへ登録</Button>
                            <Button variant="outline">修正する</Button>
                          </CardFooter>
                        </Card>
                      </div>
                    )
                  })()}
                </div>
              ))}
                {activeJobs.length > 0 && (
                  <div className="mb-4 px-4">
                    <div className="text-sm text-gray-600 mb-2">進捗中のジョブ：</div>
                    <div className="space-y-2">
                      {activeJobs.map(j => (
                        <div key={j.id} className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="text-sm text-gray-700 truncate">{j.name || `ジョブ ${j.id.slice(0,8)}`}</div>
                            <Progress value={j.progress} className="mt-1" />
                          </div>
                              <div className="text-xs w-12 text-right">{j.progress}%</div>
                              <div>
                                <Button size="sm" variant="ghost" onClick={() => cancelJob(j.id)}>
                                  キャンセル
                                </Button>
                              </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

        {/* 添付ファイルのプレビュー */}
        {pendingFiles.length > 0 && (
          <div className="mb-4 px-4">
            <div className="text-sm text-gray-600 mb-2">添付ファイル：</div>
            <div className="flex gap-2 flex-wrap">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded">
                  <div className="text-sm max-w-xs truncate">{f.name}</div>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => removePendingFile(i)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
              disabled={isLoading || (!input.trim() && pendingFiles.length === 0)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

