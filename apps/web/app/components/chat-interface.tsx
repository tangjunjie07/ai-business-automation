
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
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set())
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

  // Helper: download MF CSV text
  const downloadMfCsv = (csvText: string, baseName?: string | null) => {
    try {
      // Excel 対応のため BOM を付与
      const withBom = csvText.startsWith('\ufeff') ? csvText : `\ufeff${csvText}`
      const blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Generate filename with current date/time: YYYYMMDD_HHMMSS
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`
      
      const safe = (baseName && baseName.trim().length > 0) ? baseName : 'mf'
      a.download = `${safe}_${timestamp}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      toast.error('CSVのダウンロードに失敗しました')
    }
  }

  // Toggle checkbox selection for a specific result
  const toggleResultSelection = (index: number) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // Select all results with CSV data
  const selectAllResults = () => {
    const allResultIndices = messages
      .map((msg, index) => ({ msg, index }))
      .filter(({ msg }) => msg.analysisResult?.data?.mfCsvText)
      .map(({ index }) => index)
    
    setSelectedResults(new Set(allResultIndices))
  }

  // Deselect all results
  const deselectAllResults = () => {
    setSelectedResults(new Set())
  }

  // Download selected results as combined CSV
  const downloadSelectedCsvs = () => {
    if (selectedResults.size === 0) {
      toast.error('CSVをダウンロードするには少なくとも1つの解析結果を選択してください')
      return
    }

    const selectedMessages = Array.from(selectedResults)
      .map(index => messages[index])
      .filter(msg => msg.analysisResult?.data?.mfCsvText)

    if (selectedMessages.length === 0) {
      toast.error('選択された解析結果にCSVデータがありません')
      return
    }

    try {
      // Combine all CSV texts with sequential transaction numbers
      const allLines: string[] = []
      let transactionNumber = 1

      selectedMessages.forEach((msg, i) => {
        const csvText = msg.analysisResult!.data!.mfCsvText!
        const lines = csvText.split('\n').filter(line => line.trim() !== '') // Remove empty lines
        
        if (i === 0) {
          // First file: include header
          allLines.push(lines[0])
        }
        
        // Process data lines (skip header)
        for (let j = 1; j < lines.length; j++) {
          const line = lines[j].trim()
          if (line) {
            // Split the line to update transaction number (assuming it's the first column)
            const columns = line.split(',')
            if (columns.length > 0) {
              columns[0] = transactionNumber.toString() // Update transaction number
              allLines.push(columns.join(','))
              transactionNumber++
            }
          }
        }
      })

      // Join without extra blank lines
      const combinedCsv = allLines.join('\n')

      downloadMfCsv(combinedCsv, `selected_${selectedResults.size}_results`)
      toast.success(`${selectedResults.size}件の解析結果をダウンロードしました`)
    } catch (error) {
      console.error('CSV download error:', error)
      toast.error('CSVのダウンロード中にエラーが発生しました')
    }
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
        } catch (_) { }
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

  // Map backend WS payload to UI AnalysisResult shape
  const mapPayloadToAnalysis = (payload: any): AnalysisResult | null => {
    if (!payload) return null
    // backend may send { result: ocr_result, ai_result: ai_result } or just result
    const ocr = payload.result || payload.ocr_result || null
    const ai = payload.ai_result || payload.aiResult || null
    // mf_csv は AI 結果に含まれる想定（必要に応じて OCR 側もフォールバック）
    const mfCsvText = (ai && (ai.mf_csv || ai.mfCsv || ai.csv || ai.mf_csv_text)) || (ocr && (ocr.mf_csv || ocr.mfCsv || ocr.csv || ocr.mf_csv_text)) || null
    // Prefer AI-inferred accounts, fall back to OCR-inferred accounts
    const inferredFromAi = ai && Array.isArray(ai.inferred_accounts) && ai.inferred_accounts.length > 0 ? ai.inferred_accounts[0] : null
    const inferredFromOcr = ocr && Array.isArray(ocr.inferred_accounts) && ocr.inferred_accounts.length > 0 ? ocr.inferred_accounts[0] : null

    const candidate: any = inferredFromAi || inferredFromOcr || null
    if (!candidate) return null

    const jobId = payload.job_id || payload.jobId || null
    const fileName = payload.file_name || (candidate.file_name || candidate.fileName) || null

    // candidate may have either direct fields (accountItem, confidence, amount)
    // or a nested `accounting` array with the detailed entry.
    let accountItem = '不明'
    let confidence = 0
    if (candidate.accountItem) {
      accountItem = candidate.accountItem
      confidence = candidate.confidence || 0
    } else if (Array.isArray(candidate.accounting) && candidate.accounting.length > 0) {
      const a = candidate.accounting[0]
      accountItem = a.accountItem || a.description || accountItem
      confidence = (typeof a.confidence === 'number') ? a.confidence : (candidate.confidence || 0)
    } else if (candidate.description) {
      accountItem = candidate.description
      confidence = candidate.confidence || 0
    }

    const totalAmount = candidate.totalAmount || candidate.amount || (ai && ai.totalAmount) || (ocr && ocr.totalAmount) || null
    const projectId = candidate.projectId || (ai && ai.projectId) || (ocr && ocr.projectId) || null
    const invoiceDate = candidate.invoiceDate || (ai && ai.invoiceDate) || (ocr && ocr.invoiceDate) || null

    // Build detailed accounting list if present
    let accountingList: Array<any> = []
    if (Array.isArray(candidate.accounting) && candidate.accounting.length > 0) {
      accountingList = candidate.accounting.map((a: any) => ({
        accountItem: a.accountItem || a.description || a.account || '不明',
        subAccountItem: a.subAccountItem || a.sub_account || null,
        confidence: typeof a.confidence === 'number' ? a.confidence : (a.confidence || 0),
        amount: a.amount || a.value || null,
        date: a.date || null,
        reasoning: a.reasoning || a.reason || null
      }))
    } else if (accountItem) {
      accountingList = [{ accountItem, subAccountItem: null, confidence, amount: totalAmount, date: invoiceDate, reasoning: null }]
    }

    return {
      jobId: jobId,
      status: 'success',
      data: {
        file_name: fileName,
        invoiceDate,
        accounting: { accountItem, confidence },
        accountingList,
        totalAmount,
        projectId,
        mfCsvText: (typeof mfCsvText === 'string' && mfCsvText.length > 0) ? mfCsvText : undefined,
        hasMfCsv: !!(typeof mfCsvText === 'string' && mfCsvText.length > 0)
      }
    }
  }

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
    // If user provided only a message but no files, require attachments
    if (trimmed && pendingFiles.length === 0) {
      toast.error('ファイルの添付が必要です。ファイルを選択してください。')
      return
    }
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

    // 添付ファイルの送信ロジック（IF を常に実行するようにしました）
    const filesToSend = pendingFiles.slice()
    // UI 側は即時クリア（送信はバックグラウンドで継続）
    setPendingFiles([])

    const formData = new FormData()
    filesToSend.forEach(f => formData.append('files', f))
    if (trimmed) formData.append('message', trimmed)

      ; (async () => {
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

          // Handle init-style synchronous response: { message, suggestions }
          if (result && typeof result.message === 'string') {
            const assistantMessage: Message = { role: 'assistant', content: result.message }
            if (typeof onAddMessage === 'function') onAddMessage(assistantMessage)
          }

          // 型付きレスポンスとして扱う（ack style invoice ids）
          const invoiceIdsFromAck: string[] | undefined = (result && (result.invoiceIds || result.invoice_ids))

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
                        const analysis = mapPayloadToAnalysis(data)
                        if (analysis) {
                          const assistantMessage: Message = {
                            role: 'assistant',
                            content: '解析が完了しました（非同期結果）',
                            analysisResult: analysis
                          }
                          if (typeof onAddMessage === 'function') onAddMessage(assistantMessage)
                        }
                        setTimeout(() => setActiveJobs(prev => prev.filter(j => j.id !== jobId)), 600)
                        try { ws.close() } catch (_) { }
                        delete wsMap.current[jobId]
                        delete wsRetry.current[jobId]
                      }

                      if (data.event === 'CANCELED') {
                        setActiveJobs(prev => prev.filter(j => j.id !== jobId))
                        try { ws.close() } catch (_) { }
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
                      if (retries >= MAX_WS_RETRIES) { delete wsMap.current[jobId]; return }
                      wsRetry.current[jobId] = retries + 1
                      const backoff = WS_BACKOFF_BASE_MS * Math.pow(2, retries)
                      setTimeout(() => { const stillActive = activeJobsRef.current.find(j => j.id === jobId); if (stillActive) createWsForJob(jobId) }, backoff)
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
          // Note: synchronous immediate result-to-card mapping intentionally skipped.
          // The UI will display a single-line assistant message for sync responses
          // and create full cards only when WS 'ANALYSIS_COMPLETE' arrives.
        } catch (err) {
          console.error(err)
          toast.error('アップロードに失敗しました。')
        } finally {
          // 常に入力をクリア
          setInput('')
        }
      })()
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const cancelJob = async (jobId: string) => {
    // optimistic UI: remove job locally and close WS
    try {
      const ws = wsMap.current[jobId]
      try { ws?.close() } catch (_) { }
      delete wsMap.current[jobId]
    } catch (e) {
      console.warn('Error closing ws for cancel', e)
    }

    setActiveJobs(prev => prev.filter(j => j.id !== jobId))
    try { delete wsRetry.current[jobId] } catch (_) { }

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
        {/* Batch Download Button */}
        {(() => {
          const totalResultsWithCSV = messages.filter(msg => msg.analysisResult?.data?.mfCsvText).length
          const allSelected = totalResultsWithCSV > 0 && selectedResults.size === totalResultsWithCSV
          
          return totalResultsWithCSV > 0 && (
            <div className="mb-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-blue-700">
                  {selectedResults.size > 0 
                    ? `${selectedResults.size}件の解析結果を選択中`
                    : '解析結果を選択してください'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={allSelected ? deselectAllResults : selectAllResults}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {allSelected ? '全て解除' : '一括選択'}
                </Button>
              </div>
              {selectedResults.size > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={downloadSelectedCsvs}
                >
                  選択したCSVをダウンロード
                </Button>
              )}
            </div>
          )
        })()}
        
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
                    const invoiceDate = message.analysisResult.data?.invoiceDate || null
                    const acct = (message.analysisResult.data?.accountingList && message.analysisResult.data.accountingList[0]) || message.analysisResult.data?.accounting || null
                    const acctConfidence = acct?.confidence || 0
                    const acctName = acct?.accountItem || '不明'
                    const acctSub = acct?.subAccountItem || acct?.sub_account || null
                    const acctAmount = acct?.amount || message.analysisResult.data?.totalAmount || null
                    const acctDate = acct?.date || invoiceDate || null
                    const acctReason = acct?.reasoning || null
                    const hasCSV = !!message.analysisResult.data?.mfCsvText

                    return (
                      <div className="mt-4">
                        <Card className={selectedResults.has(index) ? 'ring-2 ring-blue-500' : ''}>
                          <CardHeader className="flex flex-row items-center gap-3">
                            {hasCSV && (
                              <input
                                type="checkbox"
                                checked={selectedResults.has(index)}
                                onChange={() => toggleResultSelection(index)}
                                className="w-5 h-5 cursor-pointer"
                              />
                            )}
                            <CardTitle className="flex-1">解析結果: {fileName || '請求書'}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {invoiceDate && <p><strong>日付:</strong> {invoiceDate}</p>}
                            <p><strong>勘定科目:</strong> {acctName} {acctSub ? `／${acctSub}` : ''} (確信度: {Math.round((acctConfidence || 0) * 100)}%)</p>
                            {acctReason && <p><strong>理由:</strong> {acctReason}</p>}
                            <p><strong>金額:</strong> {acctAmount ? `¥${Number(acctAmount).toLocaleString()}` : '不明'}</p>
                            {message.analysisResult.data?.projectId && <p><strong>プロジェクト:</strong> {message.analysisResult.data?.projectId}</p>}
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
                          <div className="text-sm text-gray-700 truncate">{j.name || `ジョブ ${j.id.slice(0, 8)}`}</div>
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

