"use client"

import React, { useRef, useEffect } from 'react'
import { Button } from '../../ui/button'
import { Upload, Send, X } from 'lucide-react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onAbort?: () => void
  onUpload?: (files: FileList | null) => void
  isStreaming?: boolean
  placeholder?: string
}

export default function ChatInput({ value, onChange, onSend, onUpload, isStreaming = false, placeholder = 'メッセージを入力...' }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [value])

  return (
    <div className="w-full">
      <div className="flex items-end gap-2 bg-chatbot-bg border border-components-panel-border rounded-lg p-2 shadow-sm">
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={(e) => onUpload?.(e.target.files)} />
        <Button variant="ghost" onClick={() => fileRef.current?.click()} aria-label="upload">
          <Upload className="h-4 w-4" />
        </Button>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
          placeholder={placeholder}
          className="flex-1 resize-none px-3 py-2 border rounded-md min-h-[40px] max-h-40 overflow-auto"
        />
        {isStreaming ? (
          <Button variant="destructive" onClick={() => onAbort?.()}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => onSend()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
