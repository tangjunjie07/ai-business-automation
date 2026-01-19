"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Paperclip, Send, Square, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onUpload,
  addFileId,
  removeFileId,
  clearFiles,
  onFilesChange,
  onAbort,
  streamError,
  onRetry
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onUpload?: (files: FileList | null) => void;
  addFileId: (id: string) => void;
  removeFileId: (id: string) => void;
  clearFiles: () => void;
  onFilesChange: (files: UploadedFile[]) => void;
  onAbort?: () => void;
  streamError?: string | null;
  onRetry?: () => void;
}) {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [files, setFiles] = useState<UploadedFile[]>([]);

  const autosize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    // reset to 0 so scrollHeight recalculates correctly including preview padding
    ta.style.height = '0px';
    const h = Math.min(ta.scrollHeight, 160); // max-height ~160px
    ta.style.height = `${h}px`;
  };

  useEffect(() => {
    // autosize on value or files change (in case parent clears it or previews change)
    autosize();
  }, [value]);

  // Recompute autosize when files change (previews affect layout)
  useEffect(() => {
    autosize();
  }, [files]);

  // Upload via local route; server route will forward to Dify API
  const uploadFileToServer = async (file: File) => {
    // ファイルタイプチェック
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`サポートされていないファイル形式です: ${file.type}`);
    }

    // ファイルサイズチェック (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`ファイルサイズが大きすぎます。最大10MBまでです。`);
    }

    const endpoint = `/api/dify/files/upload`;
    const userId = session?.user?.id as string | undefined;
    const form = new FormData();
    form.append('file', file);
    form.append('user', userId || '');

    // バックエンドAPI呼び出し時は必ず x-tenant-id ヘッダーを付与（RLS・テナント分離のため必須）
    const headers: Record<string, string> = {};
    const tenantId = session?.user?.tenantId as string | undefined;
    headers['x-tenant-id'] = tenantId || '';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: form,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `アップロードに失敗しました (${res.status})`);
    }

    const data = await res.json();
    const previewUrl = data?.preview_url || data?.source_url || data?.previewUrl || data?.preview_url;
    const type = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name) ? 'image' : 'document';
    return { id: data.id, name: data.name || file.name, previewUrl, size: data.size || file.size, type };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files ? Array.from(e.target.files) : [];
    if (incoming.length === 0) return;

    // ファイル数の制限チェック
    const maxFiles = 5;
    if (files.length + incoming.length > maxFiles) {
      toast.error(`一度にアップロードできるファイルは${maxFiles}個までです`);
      return;
    }

    // 各ファイルの事前検証
    for (const file of incoming) {
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`サポートされていないファイル形式です: ${file.name}`);
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(`ファイルサイズが大きすぎます: ${file.name} (最大10MB)`);
        return;
      }
    }

    // append placeholders and start upload
    const placeholders: UploadedFile[] = incoming.map(f => ({ name: f.name, uploading: true, original: f, size: f.size, type: f.type.includes('image') ? 'image' : 'document' }));
    setFiles(prev => {
      const newFiles = [...prev, ...placeholders];
      setTimeout(() => onFilesChange(newFiles), 0);
      return newFiles;
    });
    onUpload?.(e.target.files);

    // upload each file and update preview when done
    incoming.forEach(async (f) => {
      try {
        const uploaded = await uploadFileToServer(f);
        setFiles(prev => {
          // find the first matching placeholder by name+uploading
          const i = prev.findIndex(p => p.original === f || (p.name === f.name && p.uploading));
          if (i === -1) return prev;
          const copy = [...prev];
          copy[i] = { ...copy[i], id: uploaded.id, previewUrl: uploaded.previewUrl, uploading: false, size: uploaded.size, type: uploaded.type };
          setTimeout(() => onFilesChange(copy), 0);
          return copy;
        });
        // add to fileIds list
        addFileId(uploaded.id);
        // after upload, update parent with new FileList (optional)
        const currentFiles = fileListFromArray(files.map(x => x.original!).filter(Boolean));
        onUpload?.(currentFiles);
      } catch (error) {
        // エラーメッセージを表示
        const errorMessage = error instanceof Error ? error.message : 'アップロードに失敗しました';
        toast.error(`${f.name}: ${errorMessage}`);

        // 失敗したファイルをリストから削除
        setFiles(prev => prev.map(p => (p.original === f ? { ...p, uploading: false, error: errorMessage } : p)));
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
    } catch (_) {
      return null;
    }
  };

  const removeFile = async (index: number) => {
    const target = files[index];
    // if uploaded to server, call delete route
    if (target?.id) {
      // remove from fileIds list
      removeFileId(target.id);
    }

    const next = files.filter((f, i) => i !== index);
    setFiles(next);
    setTimeout(() => onFilesChange(next), 0);
    const originals = next.map(f => f.original).filter(Boolean) as File[];
    const fl = fileListFromArray(originals);
    onUpload?.(fl);
  };

  const handleSend = () => {
    if (!value || !value.trim()) {
      toast.error('質問は必須です。');
      return;
    }
    onSend();
    // clear attachments after send
    setFiles([]);
    setTimeout(() => onFilesChange([]), 0);
    clearFiles();
    onUpload?.(null);
  };

  // Enterキーで送信しない（送信はボタンのみ）
  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = () => {
    // 何もしない（Shift+EnterもEnterも改行のみ）
  };

  const canSend = ((value && value.trim()) || files.length > 0) && !isLoading;

  return (
    <div className="w-full bg-transparent p-4">
      <div className="max-w-2xl mx-auto w-full">
        {/* 入力エリア（プレビューを含めて一つの枠に見せる） */}
        <div className="relative flex flex-col gap-2 rounded-xl p-2 bg-white transition-all border border-divider-regular">
          {files.length > 0 && (
            <div className="w-full">
              <div className="flex flex-wrap gap-2 p-1">
                {files.map((file, index) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
                  if (isImage) {
                    return (
                      <div key={index} className="relative flex-shrink-0 w-16 h-16 bg-chat-bubble-bg/80 rounded-md border-0 flex items-center justify-center overflow-hidden p-0">
                        {file.previewUrl ? (
                          <Image
                            src={file.previewUrl}
                            alt={file.name}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-chat-bubble-bg rounded flex items-center justify-center text-xs">ファイル</div>
                        )}
                        {file.uploading && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs">アップロード中...</div>
                        )}
                        {file.error && (
                          <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white text-xs p-1 text-center">
                            エラー: {file.error}
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 text-text-tertiary hover:text-text-negative"
                          aria-label="削除"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  } else {
                    // PDFなどのファイル
                    const formatSize = (bytes: number) => {
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
                    };
                    return (
                      <a
                        key={index}
                        href={file.previewUrl}
                        target="_blank"
                        download={file.name}
                        rel="noopener noreferrer"
                        className="input-file-preview"
                      >
                        {/* 左側：PDFアイコン */}
                        <div className="file-icon-wrapper">
                          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon w-6 h-6 text-red-400">
                            <path d="M3.9985 2C3.44749 2 3 2.44405 3 2.9918V21.0082C3 21.5447 3.44476 22 3.9934 22H20.0066C20.5551 22 21 21.5489 21 20.9925L20.9997 7L16 2H3.9985ZM10.5 7.5H12.5C12.5 9.98994 14.6436 12.6604 17.3162 13.5513L16.8586 15.49C13.7234 15.0421 10.4821 16.3804 7.5547 18.3321L6.3753 16.7191C7.46149 15.8502 8.50293 14.3757 9.27499 12.6534C10.0443 10.9373 10.5 9.07749 10.5 7.5ZM11.1 13.4716C11.3673 12.8752 11.6043 12.2563 11.8037 11.6285C12.2754 12.3531 12.8553 13.0182 13.5102 13.5953C12.5284 13.7711 11.5666 14.0596 10.6353 14.4276C10.8 14.1143 10.9551 13.7948 11.1 13.4716Z"></path>
                          </svg>
                        </div>

                        {/* 右側：名前とサイズの縦並び */}
                        <div className="input-file-info">
                          <span className="input-file-name" title={file.name}>
                            {file.name}
                          </span>
                          <span className="input-file-size">
                            {file.size ? formatSize(file.size) : ''}
                          </span>
                          {file.error && (
                            <span className="text-red-500 text-xs mt-1 block">
                              エラー: {file.error}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={(e) => { e.preventDefault(); removeFile(index); }}
                          className="absolute -top-2 -right-2 bg-gray-500 rounded-full w-5 h-5 text-white text-xs flex items-center justify-center"
                          aria-label="削除"
                        >
                          ×
                        </button>
                        {file.uploading && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs rounded-lg">アップロード中...</div>
                        )}
                      </a>
                    );
                  }
                })}
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
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <button
                type="button"
                onClick={isLoading ? onAbort : handleSend}
                disabled={!canSend && !isLoading}
                aria-label={isLoading ? "停止" : "送信"}
                className={`${(canSend || isLoading) ? 'ml-2 text-white' : 'ml-2 text-text-tertiary cursor-not-allowed'} w-10 h-10 flex items-center justify-center rounded-md`}
                style={(canSend || isLoading) ? { backgroundColor: isLoading ? 'rgb(239,68,68)' : 'rgb(28,100,242)' } : undefined}
              >
                {isLoading ? <Square size={18} /> : <Send size={18} />}
              </button>
            </div>
          </div>

          {/* エラー表示とリトライボタン */}
          {streamError && !isLoading && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>送信に失敗しました</span>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    再試行
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-red-600">{streamError}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
