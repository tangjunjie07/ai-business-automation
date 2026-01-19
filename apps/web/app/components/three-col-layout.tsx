"use client"

import React from 'react'

interface Props {
  left?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}

export default function ThreeColLayout({ left, right, children }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-4 h-full flex gap-6">
      <aside className="hidden md:block w-[260px]">{left}</aside>
      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      <aside className="hidden lg:block w-[320px]">{right}</aside>
    </div>
  )
}
