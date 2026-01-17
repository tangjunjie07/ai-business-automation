import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function RenameModal({
  isShow,
  saveLoading,
  name,
  onClose,
  onSave,
}: {
  isShow: boolean;
  saveLoading: boolean;
  name: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [tempName, setTempName] = useState(name);

  useEffect(() => {
    setTempName(name);
  }, [name, isShow]);

  if (!isShow) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30">
      <div className="bg-chat-bubble-bg rounded-xl shadow-lg p-6 w-full max-w-md">
        <div className="text-lg font-semibold mb-4">会話の名前を変更</div>
        <div className="mb-2 text-sm font-medium">新しい名前</div>
        <input
          className="w-full border rounded px-3 py-2 mb-6"
          value={tempName}
          onChange={e => setTempName(e.target.value)}
          placeholder="会話名を入力"
          disabled={saveLoading}
        />
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded bg-chat-input-mask hover:bg-state-base-hover" onClick={onClose} disabled={saveLoading}>キャンセル</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => onSave(tempName)} disabled={saveLoading || !tempName.trim()}>{saveLoading ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>,
    typeof window !== 'undefined' ? document.body : (null as any)
  );
}
