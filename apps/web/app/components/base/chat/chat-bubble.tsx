"use client"

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'

type Props = {
  role: 'user' | 'assistant'
  content: string
  className?: string
}

export default function ChatBubble({ role, content, className = '' }: Props) {
  const isUser = role === 'user'
  const partialMarker = /[（\(].*(途中|中断).*[）\)]$/
  const isPartial = !isUser && partialMarker.test(content)
  const displayContent = isPartial ? content.replace(partialMarker, '').trim() : content
  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`max-w-[80%] rounded-lg p-3 ${isUser ? 'bg-blue-500 text-white' : isPartial ? 'bg-yellow-50 text-neutral-900 border border-yellow-100' : 'bg-chat-bubble-bg text-gray-900 dark:text-gray-100'}`}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        ) : (
          <div>
            <div className="prose max-w-none break-words"><ReactMarkdown rehypePlugins={[rehypeHighlight]}>{displayContent}</ReactMarkdown></div>
            {isPartial && <div className="mt-2 text-xs text-gray-500">（途中までの応答 — 中断されました）</div>}
          </div>
        )}
      </div>
    </div>
  )
}
