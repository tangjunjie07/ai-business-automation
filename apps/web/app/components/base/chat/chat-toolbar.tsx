"use client"

import React from 'react'
import { Button } from '../../ui/button'
import { RefreshCw, Trash } from 'lucide-react'

type Props = {
  onClear?: () => void
  onRefresh?: () => void
}

export default function ChatToolbar({ onClear, onRefresh }: Props) {
  return (
    <div className="flex gap-2 items-center">
      <Button variant="ghost" onClick={() => onRefresh?.()} title="リフレッシュ">
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button variant="ghost" onClick={() => onClear?.()} title="クリア">
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  )
}
