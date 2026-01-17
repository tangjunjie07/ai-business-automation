"use client"

import { useRef, useState } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

/**
 * Minimal hook skeleton to handle SSE-like streaming responses from /api/dify/chat.
 * - `send` accepts either a JSON payload or a FormData (for files).
 * - The hook exposes `messages`, `isStreaming`, `send`, and `abort`.
 *
 * This is intentionally minimal and meant as a reusable building block.
 */
export default function useDifySSE() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const append = (m: Message) => setMessages((s) => [...s, m])

  async function send(
    payload: Record<string, any> | FormData,
    opts?: { tenantId?: string; userId?: string; onChunk?: (chunk: string) => void }
  ) {
    if (isStreaming) abort()
    abortRef.current = new AbortController()
    setIsStreaming(true)

    try {
      const headers: Record<string, string> = {}
      let body: BodyInit
      if (payload instanceof FormData) {
        body = payload
      } else {
        body = JSON.stringify(payload)
        headers['Content-Type'] = 'application/json'
      }

      if (opts?.tenantId) headers['X-Tenant-ID'] = opts.tenantId
      if (opts?.userId) headers['X-USER-ID'] = opts.userId

      const res = await fetch('/api/dify/chat', { method: 'POST', headers, body, signal: abortRef.current.signal })
      if (!res.ok) throw new Error(`Upstream error: ${res.status}`)

      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          buffer += decoder.decode(value, { stream: true })

          // Basic SSE parsing: process blocks separated by double newline
          let idx = -1
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx).trim()
            buffer = buffer.slice(idx + 2)
            const dataLines = raw.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim())
            if (dataLines.length === 0) continue
            const dataStr = dataLines.join('\n')
            if (dataStr === '[DONE]') {
              // stream finished
              break
            }
            try {
              const obj = JSON.parse(dataStr)
              // Extract textual payloads from common shapes
              const chunk = obj.answer || obj.data?.answer || obj.data?.outputs?.text || obj.outputs?.text || ''
              if (chunk) {
                acc += chunk
                // notify caller about incremental chunk if requested
                if (opts?.onChunk) opts.onChunk(chunk)
                // update last assistant partial locally as well
                setMessages((prev) => {
                  const last = prev[prev.length - 1]
                  if (last && last.role === 'assistant') {
                    return [...prev.slice(0, -1), { role: 'assistant', content: last.content + chunk }]
                  }
                  return [...prev, { role: 'assistant', content: chunk }]
                })
              }
            } catch (e) {
              // ignore non-JSON
            }
          }
        }
      }

      // flush any remaining buffer
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer.trim())
          const finalText = obj.answer || obj.data?.answer || obj.data?.outputs?.text || obj.outputs?.text || ''
          if (finalText) append({ role: 'assistant', content: finalText })
        } catch (e) {}
      }

      return acc
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        // preserve partials - append a marker
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: last.content + '（途中まで）' }]
          }
          return prev
        })
      }
      throw e
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  function abort() {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      setIsStreaming(false)
    }
  }

  return { messages, isStreaming, send, abort, setMessages }
}
