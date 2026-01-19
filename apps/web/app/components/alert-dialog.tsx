import React from 'react'
import { createPortal } from 'react-dom'

export function AlertDialog({
  isOpen,
  title,
  description,
  children,
  confirmText = 'OK',
  cancelText = 'キャンセル',
  intent = 'default',
  onCancel,
  onConfirm,
  zIndex = 9999,
}: {
  isOpen: boolean
  title?: string
  description?: string
  children?: React.ReactNode
  confirmText?: string
  cancelText?: string
  intent?: 'default' | 'danger'
  onCancel: () => void
  onConfirm: () => void
  zIndex?: number
}) {
  if (!isOpen) return null

  // ensure modal backdrop blocks interaction and modal content is fully opaque
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      <div
        className="rounded-xl shadow-lg p-6 min-w-[320px] max-w-[90vw] w-full bg-white dark:bg-[#0b0b0b]"
        style={{ maxWidth: 420, zIndex: (zIndex || 9999) + 1 }}
      >
        {title && <div className="text-lg font-semibold mb-2">{title}</div>}
        {children ? (
          <div className="mb-4">{children}</div>
        ) : (
          <div className="mb-4 text-sm text-text-secondary">{description}</div>
        )}
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded bg-chat-input-mask hover:bg-state-base-hover" onClick={onCancel}>{cancelText}</button>
          <button
            className={`px-4 py-2 rounded text-white ${intent === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    typeof window !== 'undefined' ? document.body : (null as any)
  )
}

export default AlertDialog
