"use client"

import React from 'react'

interface Props {
  left?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}

export default function ThreeColLayout({ left, right, children }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-4 h-full">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_320px] gap-6 min-h-0">
        <aside className="hidden md:block">{left}</aside>
        <main className="lg:col-span-2 min-h-0 overflow-auto">{children}</main>
        <aside className="hidden lg:block">{right}</aside>
      </div>
    </div>
  )
}
