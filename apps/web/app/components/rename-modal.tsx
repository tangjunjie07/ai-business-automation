import React, { useState, useEffect } from 'react';
import AlertDialog from './alert-dialog';

export function RenameModal({
  isShow,
  saveLoading,
  name,
  onClose,
  onSave,
  zIndex = 9999,
}: {
  isShow: boolean;
  saveLoading: boolean;
  name: string;
  onClose: () => void;
  onSave: (name: string) => void;
  zIndex?: number;
}) {
  const [tempName, setTempName] = useState(name);

  useEffect(() => {
    if (isShow) {
      setTempName(name); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [name, isShow]);

  return (
    <AlertDialog
      isOpen={isShow}
      title="会話の名前を変更"
      confirmText={saveLoading ? '保存中...' : '保存'}
      cancelText="キャンセル"
      intent="default"
      onCancel={() => !saveLoading && onClose()}
      onConfirm={() => { if (!saveLoading && tempName.trim()) onSave(tempName.trim()); }}
      zIndex={zIndex}
    >
      <div>
        <div className="mb-2 text-sm font-medium">新しい名前</div>
        <input
          className="w-full border rounded px-3 py-2 mb-6"
          value={tempName}
          onChange={e => setTempName(e.target.value)}
          placeholder="会話名を入力"
          disabled={saveLoading}
        />
      </div>
    </AlertDialog>
  );
}
