import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';
import config from '@/config';
import { Session } from '@/types/next-auth';
import Image from 'next/image';
import { UploadedFile } from '@/types/dify';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  message_files?: UploadedFile[];
}

export function MessageList({ messages, session, currentTask, isLoading }: { messages: Message[]; session?: Session; currentTask?: string; isLoading?: boolean }) {
  const userInitials = (() => {
    const name = session?.user?.name || session?.user?.email || '';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();

  return (
    <div className="space-y-4">
      {messages.map((message, idx) => {
        const isAssistant = message.role === 'assistant';
        if (isAssistant) {
          return (
            <div key={idx} className="mb-2 flex last:mb-0">
              <div className="relative h-10 w-10 shrink-0">
                <div className="flex items-center justify-center w-full h-full rounded-full border-[0.5px] border-black/5 text-xl" style={{ background: 'rgb(255, 234, 213)' }}>
                  {config.ui.assistantIcon}
                </div>
              </div>
              <div className="chat-answer-container group ml-4 w-0 grow pb-4">
                <div className="group relative pr-10">
                  <div className="body-lg-regular relative inline-block max-w-full rounded-2xl bg-gray-100 px-4 py-3 text-text-primary">
                    {message.message_files && message.message_files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {message.message_files.map((file, fileIdx) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.filename || file.name || '');
                          const formatSize = (bytes: number) => {
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
                          };
                          const handleDownload = async (file: UploadedFile) => {
                            try {
                              const response = await fetch(file.url);
                              if (!response.ok) {
                                throw new Error('File not found or signature is invalid');
                              }
                              const blob = await response.blob();
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', file.filename || file.name);
                              link.setAttribute('target', '_blank');
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            } catch (_) {
                              console.error("ダウンロードに失敗しました。URLの期限が切れている可能性があります。");
                              toast.error("ダウンロードに失敗しました。URLの期限が切れている可能性があります。");
                            }
                          };
                          if (isImage) {
                            return (
                              <div key={fileIdx} className="group/file-image relative cursor-pointer">
                                <div className="border-[2px] border-gray-300 h-[68px] w-[68px] shadow-md">
                                  <Image
                                    className="h-full w-full object-cover cursor-pointer"
                                    alt="Preview"
                                    src={file.url}
                                    width={68}
                                    height={68}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDownload(file)}
                                  className="action-btn action-btn-m absolute -right-1 -top-1 hidden group-hover:flex"
                                >
                                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-3.5 w-3.5 text-white/80">
                                    <path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z"></path>
                                  </svg>
                                </button>
                              </div>
                            );
                          } else {
                            // PDFなど
                            return (
                              <div key={fileIdx} className="file-preview-item group relative">
                                {/* 左側：PDFアイコン */}
                                <div className="file-icon-wrapper">
                                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon w-6 h-6 text-red-400">
                                    <path d="M3.9985 2C3.44749 2 3 2.44405 3 2.9918V21.0082C3 21.5447 3.44476 22 3.9934 22H20.0066C20.5551 22 21 21.5489 21 20.9925L20.9997 7L16 2H3.9985ZM10.5 7.5H12.5C12.5 9.98994 14.6436 12.6604 17.3162 13.5513L16.8586 15.49C13.7234 15.0421 10.4821 16.3804 7.5547 18.3321L6.3753 16.7191C7.46149 15.8502 8.50293 14.3757 9.27499 12.6534C10.0443 10.9373 10.5 9.07749 10.5 7.5ZM11.1 13.4716C11.3673 12.8752 11.6043 12.2563 11.8037 11.6285C12.2754 12.3531 12.8553 13.0182 13.5102 13.5953C12.5284 13.7711 11.5666 14.0596 10.6353 14.4276C10.8 14.1143 10.9551 13.7948 11.1 13.4716Z"></path>
                                  </svg>
                                </div>

                                {/* 右側：名前とサイズの縦並び */}
                                <div className="file-info-wrapper">
                                  <span className="file-name" title={file.filename}>
                                    {file.filename}
                                  </span>
                                  <span className="file-size">
                                    {file.size ? formatSize(file.size) : ''}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDownload(file)}
                                  className="action-btn action-btn-m absolute -right-1 -top-1 hidden group-hover:flex"
                                >
                                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-3.5 w-3.5 text-white/80">
                                    <path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z"></path>
                                  </svg>
                                </button>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}
                    <div></div>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm max-w-none text-slate-800 leading-relaxed"
                      components={{
                        code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = node?.tagName === 'code' && !match;
                          return !isInline && match ? (
                            <SyntaxHighlighter style={oneLight} language={match[1]} PreTag="div" {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className="system-xs-regular mt-1 flex items-center text-text-quaternary opacity-0 group-hover:opacity-100"></div>
              </div>
            </div>
          );
        } else {
          return (
            <div key={idx} className="mb-2 flex last:mb-0 justify-end">
              <div className="chat-answer-container group mr-4 w-0 grow pb-4 flex justify-end">
                <div className="group relative pl-10">
                  <div className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-white">
                    {message.message_files && message.message_files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {message.message_files.map((file, fileIdx) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.filename || file.name || '');
                          const formatSize = (bytes: number) => {
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
                          };
                          const handleDownload = async (file: UploadedFile) => {
                            try {
                              const response = await fetch(file.url);
                              if (!response.ok) {
                                throw new Error('File not found or signature is invalid');
                              }
                              const blob = await response.blob();
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', file.filename || file.name);
                              link.setAttribute('target', '_blank');
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            } catch (_) {
                              console.error("ダウンロードに失敗しました。URLの期限が切れている可能性があります。");
                              toast.error("ダウンロードに失敗しました。URLの期限が切れている可能性があります。");
                            }
                          };
                          if (isImage) {
                            return (
                              <div key={fileIdx} className="group/file-image relative cursor-pointer">
                                <div className="border-[2px] border-white/20 h-[68px] w-[68px] shadow-md">
                                  <Image
                                    className="h-full w-full object-cover cursor-pointer"
                                    alt="Preview"
                                    src={file.url}
                                    width={68}
                                    height={68}
                                  />
                                </div>
                                <div className="absolute inset-0.5 z-10 hidden bg-black bg-opacity-[0.3] group-hover/file-image:block">
                                  <div className="absolute bottom-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white shadow-md">
                                    <button
                                      type="button"
                                      onClick={() => handleDownload(file)}
                                      className="w-full h-full flex items-center justify-center"
                                    >
                                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4 text-gray-600">
                                        <path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z"></path>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            // PDFなど
                            return (
                              <div key={fileIdx} className="file-preview-item group relative">
                                {/* 左側：PDFアイコン */}
                                <div className="file-icon-wrapper">
                                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon w-6 h-6 text-red-400">
                                    <path d="M3.9985 2C3.44749 2 3 2.44405 3 2.9918V21.0082C3 21.5447 3.44476 22 3.9934 22H20.0066C20.5551 22 21 21.5489 21 20.9925L20.9997 7L16 2H3.9985ZM10.5 7.5H12.5C12.5 9.98994 14.6436 12.6604 17.3162 13.5513L16.8586 15.49C13.7234 15.0421 10.4821 16.3804 7.5547 18.3321L6.3753 16.7191C7.46149 15.8502 8.50293 14.3757 9.27499 12.6534C10.0443 10.9373 10.5 9.07749 10.5 7.5ZM11.1 13.4716C11.3673 12.8752 11.6043 12.2563 11.8037 11.6285C12.2754 12.3531 12.8553 13.0182 13.5102 13.5953C12.5284 13.7711 11.5666 14.0596 10.6353 14.4276C10.8 14.1143 10.9551 13.7948 11.1 13.4716Z"></path>
                                  </svg>
                                </div>

                                {/* 右側：名前とサイズの縦並び */}
                                <div className="file-info-wrapper">
                                  <span className="file-name" title={file.filename || file.name}>
                                    {file.filename || file.name}
                                  </span>
                                  <span className="file-size">
                                    {file.size ? formatSize(file.size) : ''}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDownload(file)}
                                  className="action-btn action-btn-m absolute -right-1 -top-1 hidden group-hover:flex"
                                >
                                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-3.5 w-3.5 text-white/80">
                                    <path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z"></path>
                                  </svg>
                                </button>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}
                    <div className="markdown-body !text-white">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-sm max-w-none text-white leading-relaxed"
                        components={{
                          code({ node, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = node?.tagName === 'code' && !match;
                            return !isInline && match ? (
                              <SyntaxHighlighter style={oneLight} language={match[1]} PreTag="div" {...props}>
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative h-10 w-10 shrink-0">
                <div className="flex items-center justify-center w-full h-full rounded-full border-[0.5px] border-black/5 text-xl bg-blue-500 text-white">
                  {userInitials}
                </div>
              </div>
            </div>
          );
        }
      })}
      {isLoading && currentTask && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
          {currentTask}
        </div>
      )}
    </div>
  );
}
