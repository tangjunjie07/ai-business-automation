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
    // autosize on value or files change (in case parent clears it or previews change)
    autosize();
  }, [value]);

  const autosize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    // reset to 0 so scrollHeight recalculates correctly including preview padding
    ta.style.height = '0px';
    const h = Math.min(ta.scrollHeight, 160); // max-height ~160px
    ta.style.height = `${h}px`;
  };

  // Recompute autosize when files change (previews affect layout)
  useEffect(() => {
    autosize();
  }, [files]);

  // Upload via local route; server route will forward to Dify API
  const uploadFileToServer = async (file: File) => {
    const endpoint = `/api/dify/files/upload`;
    const form = new FormData();
    form.append('file', file);
    form.append('user', 'web-client');

    // バックエンドAPI呼び出し時は必ず x-tenant-id ヘッダーを付与（RLS・テナント分離のため必須）
    const headers: Record<string, string> = {};
    const tenantId = session?.user?.tenantId as string | undefined;
    headers['x-tenant-id'] = tenantId || '';

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
        // バックエンドAPI呼び出し時は必ず x-tenant-id ヘッダーを付与
        const headers: Record<string, string> = {};
        const tenantId = session?.user?.tenantId as string | undefined;
        headers['x-tenant-id'] = tenantId || '';
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
    if (!value || !value.trim()) {
      return;
    }
    onSend();
    // clear attachments after send
    setFiles([]);
    onUpload?.(null);
  };

  // Enterキーで送信しない（送信はボタンのみ）
  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // 何もしない（Shift+EnterもEnterも改行のみ）
  };

  const canSend = ((value && value.trim()) || files.length > 0) && !isLoading;

  return (
    <div className="w-full bg-transparent p-4">
      <div className="max-w-2xl mx-auto w-full">
        {/* 入力エリア（プレビューを含めて一つの枠に見せる） */}
        <div className="relative flex flex-col gap-2 rounded-xl p-2 bg-chatbot-bg transition-all border border-divider-regular">
          {files.length > 0 && (
            <div className="w-full">
              <div className="flex flex-wrap gap-2 p-1">
                {files.map((file, index) => (
                  <div key={index} className="relative flex-shrink-0 w-16 h-16 bg-chat-bubble-bg/80 rounded-md border-0 flex items-center justify-center overflow-hidden p-0">
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="object-cover w-full h-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-chat-bubble-bg rounded flex items-center justify-center text-xs">ファイル</div>
                    )}
                    {file.uploading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs">アップロード中...</div>
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 text-text-tertiary hover:text-text-negative"
                      aria-label="削除"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-row w-full items-end gap-2">
            {/* テキストエリア */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={e => { onChange(e.target.value); autosize(); }}
              onInput={autosize}
              onKeyDown={onKeyDown}
              placeholder={files.length > 0 ? 'ファイルが添付されています。メッセージを入力...' : 'メッセージを入力...'}
              className="flex-1 max-h-40 p-2 outline-none resize-none bg-transparent focus:outline-none focus:ring-0 text-text-primary placeholder:text-gray-400"
              disabled={isLoading}
            />
            {/* 右側アイコン群: 添付, 送信 */}
            <div className="flex flex-row items-end gap-1 ml-2">
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
                className={`${canSend ? 'ml-2 text-white' : 'ml-2 text-text-tertiary cursor-not-allowed'} w-10 h-10 flex items-center justify-center rounded-md`}
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
    </div>
  );
}
