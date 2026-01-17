"use client"

import React from 'react'

type Props = {
  children?: React.ReactNode
  className?: string
}

export default function ChatContainer({ children, className = '' }: Props) {
  return (
    <div className={`flex flex-col w-full h-full bg-transparent ${className}`}>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
