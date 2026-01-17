import React from 'react'

interface Props {
  left?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}

export default function ThreeColLayout({ left, right, children }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_320px] gap-6">
        <aside className="hidden md:block">{left}</aside>
        <main>{children}</main>
        <aside className="hidden lg:block">{right}</aside>
      </div>
    </div>
  )
}
