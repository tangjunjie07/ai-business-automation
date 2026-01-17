"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Paperclip, Send, X } from 'lucide-react';

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onStop,
  onUpload
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onStop: () => void;
  onUpload: (files: FileList | null) => void;
}) {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  type UploadedFile = {
    id?: string;
    name: string;
    previewUrl?: string;
    uploading?: boolean;
    original?: File;
  };

  const [files, setFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    // autosize on value change (in case parent clears it)
    autosize();
  }, [value]);

  const autosize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const h = Math.min(ta.scrollHeight, 160); // max-height ~160px
    ta.style.height = `${h}px`;
  };

  // Upload via local route; server route will forward to Dify API
  const uploadFileToServer = async (file: File) => {
    const endpoint = `/api/dify/files/upload`;
    const form = new FormData();
    form.append('file', file);
    form.append('user', 'web-client');

    const headers: Record<string, string> = {};
    const tenantId = session?.user?.tenantId as string | undefined;
    if (tenantId) headers['x-tenant-id'] = tenantId;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: form,
    });
    if (!res.ok) throw new Error('upload failed');
    const data = await res.json();
    const previewUrl = data?.preview_url || data?.source_url || data?.previewUrl || data?.preview_url;
    return { id: data.id, name: data.name || file.name, previewUrl };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files ? Array.from(e.target.files) : [];
    if (incoming.length === 0) return;

    // append placeholders and start upload
    const placeholders: UploadedFile[] = incoming.map(f => ({ name: f.name, uploading: true, original: f }));
    setFiles(prev => [...prev, ...placeholders]);
    onUpload?.(e.target.files);

    // upload each file and update preview when done
    incoming.forEach(async (f, idx) => {
      try {
        const uploaded = await uploadFileToServer(f);
        setFiles(prev => {
          // find the first matching placeholder by name+uploading
          const i = prev.findIndex(p => p.original === f || (p.name === f.name && p.uploading));
          if (i === -1) return prev;
          const copy = [...prev];
          copy[i] = { ...copy[i], id: uploaded.id, previewUrl: uploaded.previewUrl, uploading: false };
          return copy;
        });
        // after upload, update parent with new FileList (optional)
        const currentFiles = fileListFromArray(files.map(x => x.original!).filter(Boolean));
        onUpload?.(currentFiles);
      } catch (err) {
        // mark as not uploading and keep name, you may surface error
        setFiles(prev => prev.map(p => (p.original === f ? { ...p, uploading: false } : p)));
      }
    });

    // allow selecting same file again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileListFromArray = (arr: File[]) => {
    try {
      const dt = new DataTransfer();
      arr.forEach(f => dt.items.add(f));
      return dt.files;
    } catch (e) {
      return null;
    }
  };

  const removeFile = async (index: number) => {
    const target = files[index];
    // if uploaded to server, call delete route
    if (target?.id) {
      try {
        const headers: Record<string, string> = {};
        const tenantId = session?.user?.tenantId as string | undefined;
        if (tenantId) headers['x-tenant-id'] = tenantId;
        await fetch(`/api/dify/files/${target.id}`, { method: 'DELETE', headers });
      } catch (e) {
        // ignore failures for now
      }
    }

    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    const originals = next.map(f => f.original).filter(Boolean) as File[];
    const fl = fileListFromArray(originals);
    onUpload?.(fl);
  };

  const handleSend = () => {
    if ((!value || !value.trim()) && files.length === 0) return;
    onSend();
    // clear attachments after send
    setFiles([]);
    onUpload?.(null);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = ((value && value.trim()) || files.length > 0) && !isLoading;

  return (
    <div className="w-full bg-transparent p-4">
      <div className="max-w-2xl mx-auto w-full">

        {/* ファイルプレビュー（入力ボックス内に表示） */}
        {files.length > 0 && (
          <div className="w-full mb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 px-1">
              {files.map((file, index) => (
                <div key={index} className="relative flex-shrink-0 w-36 h-12 bg-chat-bubble-bg/80 rounded-md border border-components-panel-border flex items-center px-2 text-sm">
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt={file.name}
                      className="w-10 h-10 object-cover rounded mr-2 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-chat-bubble-bg rounded mr-2 flex items-center justify-center text-xs flex-shrink-0">ファイル</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-text-tertiary">{file.uploading ? 'アップロード中...' : ''}</div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-2 text-text-tertiary hover:text-text-negative"
                    aria-label="削除"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 入力エリア */}
        <div className="relative flex items-end gap-2 border rounded-xl p-2 shadow-sm bg-chatbot-bg">
          {/* 自動伸長テキストエリア */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={e => { onChange(e.target.value); autosize(); }}
            onInput={autosize}
            onKeyDown={onKeyDown}
            placeholder={files.length > 0 ? 'ファイルが添付されています。メッセージを入力...' : 'メッセージを入力...'}
            className="flex-1 max-h-40 p-2 outline-none resize-none bg-transparent text-text-primary focus:outline-none focus:ring-0"
            disabled={isLoading}
          />

          {/* 右側アイコン群: 添付, 送信 */}
          <div className="flex items-center gap-2 ml-2">
            <label className="p-2 cursor-pointer text-text-tertiary hover:text-text-secondary">
              <Paperclip size={20} />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="送信"
              className={`${canSend ? 'ml-3 text-white' : 'ml-3 text-text-tertiary cursor-not-allowed'} w-10 h-10 flex items-center justify-center rounded-md`}
              style={canSend ? { backgroundColor: 'rgb(28,100,242)' } : undefined}
            >
              <Send size={18} />
            </button>
          </div>
          {isLoading && (
            <button type="button" className="ml-2 text-sm text-gray-500" onClick={onStop}>停止</button>
          )}
        </div>
      </div>
    </div>
  );
}
