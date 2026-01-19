  "use client";
import React, { useEffect, useState, useRef } from 'react';
// ...existing code...
import { RenameModal } from '../components/rename-modal';
import AlertDialog from '../components/alert-dialog';
// Dify風テーマスイッチャーをインライン実装
import { Trash, Edit } from 'lucide-react'
import config from '@/config'


// sessions: {difyId, title, isPinned, updatedAt}[]
export function Sidebar({ sessions = [], onSelect, onClose, onPin, onDelete, onNewChat, onRename, messages = [], tenantId, userId, currentSessionId }: { sessions?: { difyId: string; title: string; isPinned: boolean; updatedAt: number }[]; onSelect?: (id: string) => void; onClose?: () => void; onPin?: (id: string) => void; onDelete?: (id: string) => void; onNewChat?: () => void; onRename?: (id: string, name: string) => void; messages?: unknown[]; tenantId?: string; userId?: string; currentSessionId?: string }) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ show: boolean; id: string | null; name: string }>({ show: false, id: null, name: '' });
  const [renameLoading, setRenameLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; type: 'pin' | 'delete' | null; id?: string; currentPinned?: boolean; message?: string }>({ show: false, type: null });
  const [localSessions, setLocalSessions] = useState(sessions);

  useEffect(() => {
    setLocalSessions(sessions);
  }, [sessions]);

  // sessionsからピン留め・非ピン留め分離
  const pinnedItems = localSessions.filter(i => i.isPinned);
  const unpinnedItems = localSessions.filter(i => !i.isPinned);

  async function togglePinLocal(id: string, currentPinned: boolean) {
    // show confirmation dialog instead of native confirm
    setConfirmDialog({ show: true, type: 'pin', id, currentPinned, message: currentPinned ? 'ピン留めを解除しますか？' : 'この会話をピン留めしますか？' });
  }

  function handleRename(id: string) {
    const item = sessions.find(i => i.difyId === id);
    setRenameModal({ show: true, id, name: item?.title || '' });
  }

  async function handleRenameSave(newName: string) {
    if (!renameModal.id) return;
    setRenameLoading(true);
    try {
      const response = await fetch(`/api/dify/chat-sessions/${renameModal.id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId || '' },
        body: JSON.stringify({ title: newName }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('名前変更に失敗しました');
      }
      setRenameModal({ show: false, id: null, name: '' });
      if (onRename) onRename(renameModal.id, newName);
    } catch (error) {
      // エラーハンドリングを削除
    } finally {
      setRenameLoading(false);
    }
  }
  async function handleDelete(id: string) {
    // show confirmation dialog instead of native confirm
    setConfirmDialog({ show: true, type: 'delete', id, message: 'この会話を削除します。よろしいですか？' });
  }

  async function handleConfirmAction() {
    if (!confirmDialog.type || !confirmDialog.id) return;
    const id = confirmDialog.id;
    try {
      if (confirmDialog.type === 'pin') {
        const nextPinned = !confirmDialog.currentPinned;
        await fetch(`/api/dify/chat-sessions/${id}/pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId || '' },
          body: JSON.stringify({ isPinned: nextPinned }),
        });
        setLocalSessions(prev => prev.map(s => s.difyId === id ? { ...s, isPinned: nextPinned } : s));
        if (onPin) onPin(id);
      } else if (confirmDialog.type === 'delete') {
        await fetch(`/api/dify/conversations/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId || '' },
          body: JSON.stringify({ user: userId || '' }),
        });
        setLocalSessions(prev => prev.filter(s => s.difyId !== id));
        if (onDelete) onDelete(id);
        // 削除後に新規チャットに切り替えるのは選択済みの場合のみ（onDeleteコールバック内で処理）
      }
    } catch (e) {
      // ignore; UI will remain stable
    } finally {
      setConfirmDialog({ show: false, type: null });
    }
  }

  return (
    <div className="flex w-full grow flex-col min-h-0 relative bg-chatbot-bg transition-colors duration-300">
      {/* header: avatar + title + icon */}
      <div className="flex shrink-0 items-center gap-3 p-3 pr-2">
        <div className="shrink-0">
          <span className="flex items-center justify-center relative grow-0 shrink-0 overflow-hidden border-[0.5px] border-divider-regular w-10 h-10 text-[24px] rounded-[10px]" style={{ background: 'rgb(255, 234, 213)' }}>
            <span>{config.ui.assistantIcon}</span>
          </span>
        </div>
        <div className="system-md-semibold grow truncate text-text-secondary">ai-business-automation</div>
        <button type="button" className="p-2 action-btn action-btn-l" aria-label="close-sidebar" onClick={() => onClose?.()}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-[18px] w-[18px]"><path d="M21 3C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H21ZM20 5H4V19H20V5ZM18 7V17H16V7H18Z"></path></svg>
        </button>
      </div>

      {/* new chat button */}
      <div className="shrink-0 px-3 py-4">
        <button
          type="button"
          className="w-full justify-center flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600 transition-all"
          onClick={() => {
            // 新規チャットボタン押下時はonNewChatコールバックを直接呼ぶ
            onNewChat?.();
          }}
          aria-label="new-chat-sidebar"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4"><path d="M16.7574 2.99678L14.7574 4.99678H5V18.9968H19V9.23943L21 7.23943V19.9968C21 20.5491 20.5523 20.9968 20 20.9968H4C3.44772 20.9968 3 20.5491 3 19.9968V3.99678C3 3.4445 3.44772 2.99678 4 2.99678H16.7574ZM20.4853 2.09729L21.8995 3.5115L12.7071 12.7039L11.2954 12.7064L11.2929 11.2897L20.4853 2.09729Z"></path></svg>
          <span className="whitespace-nowrap">新規チャット</span>
        </button>
      </div>

      {/* history list (scrollable) */}
      <div className="h-0 grow space-y-2 overflow-y-auto px-3 pt-4 min-h-0 pb-28">
        <div className="space-y-0.5">
          {pinnedItems.length > 0 && (
            <div className="mb-3">
              <div className="system-xs-medium text-text-tertiary mb-2">ピン留め済み</div>
              <div className="space-y-0.5">
                {pinnedItems.map(item => (
                  <div key={item.difyId} className={`system-sm-medium group relative flex cursor-pointer rounded-lg p-1 pl-3 ${item.difyId === currentSessionId ? 'bg-state-base-active text-text-accent' : 'hover:bg-state-base-hover'}`} onClick={() => onSelect?.(item.difyId)}>
                    <div className="grow truncate p-1 pl-0 group-hover:text-[color:var(--brand)]" title={item.title}>{item.title}</div>
                    <div className="shrink-0">
                      {item.difyId !== 'new' && (
                        <div className="inline-block" data-state="closed">
                          <button type="button" className="action-btn action-btn-m opacity-0 group-hover:opacity-100" aria-hidden onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === item.difyId ? null : item.difyId); }}>
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4"><path d="M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10ZM19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"></path></svg>
                          </button>
                          {menuOpenId === item.difyId && (
                              <div className="absolute right-3 top-full mt-2 w-36 rounded-xl border-[0.5px] border-components-panel-border bg-white dark:bg-[#0b0b0b] p-1 shadow-lg z-[9999]" onClick={(e) => e.stopPropagation()}>
                              <div className="system-sm-regular flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-1 text-text-secondary hover:bg-state-base-hover" onClick={() => { togglePinLocal(item.difyId, item.isPinned); setMenuOpenId(null); }}>
                                <svg className="h-3 w-3 shrink-0 text-text-tertiary" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2L8 4H5V8L2 11V13H5L8 16V20H10V16L13 13V9H10L7 6V4H10L6 0Z"/></svg>
                                <span className="truncate">{item.isPinned ? 'ピン留め解除' : 'ピン留め'}</span>
                              </div>
                              <div className="system-sm-regular flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-1 text-text-secondary hover:bg-state-base-hover" onClick={() => { handleRename(item.difyId); setMenuOpenId(null); }}>
                                <Edit className="h-4 w-4 shrink-0 text-text-tertiary" />
                                <span className="truncate">名前変更</span>
                              </div>
                              <div className="system-sm-regular group flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-1 text-text-secondary hover:bg-state-destructive-hover hover:text-text-destructive" onClick={() => { handleDelete(item.difyId); setMenuOpenId(null); }}>
                                <Trash className="h-4 w-4 shrink-0 text-text-tertiary group-hover:text-text-destructive" />
                                <span className="truncate">削除</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pinnedItems.length > 0 && (
            <div className="system-xs-medium text-text-tertiary mb-2">チャット</div>
          )}

          {unpinnedItems.map((item, idx) => (
            <div key={item.difyId || `new-${idx}`} className={`system-sm-medium group relative flex cursor-pointer rounded-lg p-1 pl-3 ${item.difyId === currentSessionId ? 'bg-state-base-active text-text-accent' : 'hover:bg-state-base-hover'}`} onClick={() => onSelect?.(item.difyId)}>
              <div className="grow truncate p-1 pl-0 group-hover:text-[color:var(--brand)]" title={item.title}>{item.title}</div>
              <div className="shrink-0">
                {item.difyId !== 'new' && (
                  <div className="inline-block" data-state="closed">
                    <button type="button" className="action-btn action-btn-m opacity-0 group-hover:opacity-100" aria-hidden onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === item.difyId ? null : item.difyId); }}>
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4"><path d="M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10ZM19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"></path></svg>
                    </button>
                    {menuOpenId === item.difyId && (
                      <div className="absolute right-3 top-full mt-2 w-36 rounded-xl border-[0.5px] border-components-panel-border bg-white dark:bg-[#0b0b0b] p-1 shadow-lg z-[9999]" onClick={(e) => e.stopPropagation()}>
                        <div className="system-sm-regular flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-1 text-text-secondary hover:bg-state-base-hover" onClick={() => { togglePinLocal(item.difyId, item.isPinned); setMenuOpenId(null); }}>
                          {item.isPinned ? (
                            <svg className="h-4 w-4 shrink-0 text-text-tertiary" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2L8 4H5V8L2 11V13H5L8 16V20H10V16L13 13V9H10L7 6V4H10L6 0Z"/></svg>
                          ) : (
                            <svg className="h-4 w-4 shrink-0 text-text-tertiary" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2L8 4H5V8L2 11V13H5L8 16V20H10V16L13 13V9H10L7 6V4H10L6 0Z"/></svg>
                          )}
                          <span className="truncate">{item.isPinned ? 'ピン留め解除' : 'ピン留め'}</span>
                        </div>
                        <div className="system-sm-regular flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-1 text-text-secondary hover:bg-state-base-hover" onClick={() => { handleRename(item.difyId); setMenuOpenId(null); }}>
                          <svg className="h-4 w-4 shrink-0 text-text-tertiary" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                          <span className="truncate">名前変更</span>
                        </div>
                        <div className="system-sm-regular group flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-1 text-text-secondary hover:bg-state-destructive-hover hover:text-text-destructive" onClick={() => { handleDelete(item.difyId); setMenuOpenId(null); }}>
                          <svg className="h-4 w-4 shrink-0 text-text-tertiary group-hover:text-text-destructive" viewBox="0 0 24 24" fill="currentColor"><path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zM9 4h6l1 1H8l1-1z"/></svg>
                          <span className="truncate">削除</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 名前変更モーダル */}
      <RenameModal
        isShow={renameModal.show}
        saveLoading={renameLoading}
        name={renameModal.name}
        onClose={() => setRenameModal({ show: false, id: null, name: '' })}
        onSave={handleRenameSave}
        zIndex={99999}
      />
      <AlertDialog
        isOpen={confirmDialog.show}
        title={confirmDialog.type === 'delete' ? '会話を削除' : '確認'}
        description={confirmDialog.message || ''}
        confirmText={confirmDialog.type === 'delete' ? '削除' : '確認'}
        cancelText="キャンセル"
        intent={confirmDialog.type === 'delete' ? 'danger' : 'default'}
        onCancel={() => setConfirmDialog({ show: false, type: null })}
        onConfirm={handleConfirmAction}
      />
      {/* footer: theme controls + powered-by (sticky bottom so it's always visible) */}
      <div className="absolute bottom-0 left-0 w-full flex shrink-0 items-center justify-between p-3 border-t border-divider-regular bg-chatbot-bg z-50">
        <div className="inline-block w-full" data-state="closed">
          <div className="p-1">
            <div className="system-md-regular flex cursor-pointer items-center rounded-lg py-1.5 pl-3 pr-2 text-text-secondary">
              <ThemeSegmentedControl />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dify風テーマ切替コンポーネント
function ThemeSegmentedControl() {
  const [theme, setTheme] = React.useState<'auto' | 'light' | 'dark'>('auto');

  // 初期状態: data-theme 属性優先、その次に html.class、最後に auto
  React.useEffect(() => {
    const html = document.documentElement;
    const attr = html.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') {
      setTheme(attr as 'dark' | 'light');
      return;
    }
    if (html.classList.contains('dark')) {
      setTheme('dark');
      return;
    }
    setTheme('auto');
  }, []);

  // テーマ適用ロジック（Tailwind の class と globals.css の data-theme 両方を更新）
  React.useEffect(() => {
    const html = document.documentElement;

    function applyTheme(t: 'auto' | 'light' | 'dark') {
      // まず既存の制御クラスを取り除く
      html.classList.remove('dark', 'light');
      if (t === 'dark') {
        html.classList.add('dark');
        html.setAttribute('data-theme', 'dark');
      } else if (t === 'light') {
        // Tailwind は light クラスを参照しないが、他のスタイルで使われる場合があるため追加
        html.classList.add('light');
        html.setAttribute('data-theme', 'light');
      } else {
        // auto: data-theme を削除して、システムプリファレンスに従う
        html.removeAttribute('data-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) html.classList.add('dark');
      }
    }

    applyTheme(theme);
  }, [theme]);

  // システムプリファレンスの変更をリスン（auto 時のみ適用）
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme !== 'auto') return;
      const html = document.documentElement;
      html.classList.toggle('dark', e.matches);
    };
    // modern browsers support addEventListener on MediaQueryList
    mediaQuery.addEventListener?.('change', handleChange);
    // fallback for older browsers
    mediaQuery.addListener?.(handleChange);
    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
      mediaQuery.removeListener?.(handleChange);
    };
  }, [theme]);

  // アイコンSVG
  const icons = {
    auto: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4"><path d="M4 16H20V5H4V16ZM13 18V20H17V22H7V20H11V18H2.9918C2.44405 18 2 17.5511 2 16.9925V4.00748C2 3.45107 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44892 22 4.00748V16.9925C22 17.5489 21.5447 18 21.0082 18H13Z"></path></svg>
    ),
    light: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4"><path d="M12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM11 1H13V4H11V1ZM11 20H13V23H11V20ZM3.51472 4.92893L4.92893 3.51472L7.05025 5.63604L5.63604 7.05025L3.51472 4.92893ZM16.9497 18.364L18.364 16.9497L20.4853 19.0711L19.0711 20.4853L16.9497 18.364ZM19.0711 3.51472L20.4853 4.92893L18.364 7.05025L16.9497 5.63604L19.0711 3.51472ZM5.63604 16.9497L7.05025 18.364L4.92893 20.4853L3.51472 19.0711L5.63604 16.9497ZM23 11V13H20V11H23ZM4 11V13H1V11H4Z"></path></svg>
    ),
    dark: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-4 w-4"><path d="M10 7C10 10.866 13.134 14 17 14C18.9584 14 20.729 13.1957 21.9995 11.8995C22 11.933 22 11.9665 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C12.0335 2 12.067 2 12.1005 2.00049C10.8043 3.27098 10 5.04157 10 7ZM4 12C4 16.4183 7.58172 20 12 20C15.0583 20 17.7158 18.2839 19.062 15.7621C18.3945 15.9187 17.7035 16 17 16C12.0294 16 8 11.9706 8 7C8 6.29648 8.08133 5.60547 8.2379 4.938C5.71611 6.28423 4 8.9417 4 12Z"></path></svg>
    ),
  };

  // 汎用的に「ライト系ならブランド色アイコン＋白地、ダーク系なら白アイコン＋暗地」を表示
  const prefersDarkNow = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveDark = theme === 'dark' || (theme === 'auto' && prefersDarkNow);

  return (
    <div className="flex items-center rounded-[10px] bg-components-segmented-control-bg-normal p-0.5">
      <button
        onClick={() => setTheme('auto')}
        className={`rounded-full p-1.5 mr-1 ${effectiveDark ? 'bg-components-segmented-control-item-active-bg' : 'bg-components-segmented-control-item-bg shadow-sm'} border border-transparent hover:opacity-95`}
        aria-label="自動テーマ"
      >
        <div className={`p-0.5 ${effectiveDark ? 'text-white' : 'text-brand'}`}>{icons.auto}</div>
      </button>
      <button
        onClick={() => setTheme('light')}
        className={`rounded-full p-1.5 mx-1 ${effectiveDark ? 'bg-components-segmented-control-item-active-bg' : 'bg-components-segmented-control-item-bg shadow-sm'} border border-transparent hover:opacity-95`}
        aria-label="ライトテーマ"
      >
        <div className={`p-0.5 ${effectiveDark ? 'text-white' : 'text-brand'}`}>{icons.light}</div>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`rounded-full p-1.5 ml-1 ${effectiveDark ? 'bg-components-segmented-control-item-active-bg' : 'bg-components-segmented-control-item-bg shadow-sm'} border border-transparent hover:opacity-95`}
        aria-label="ダークテーマ"
      >
        <div className={`p-0.5 ${effectiveDark ? 'text-white' : 'text-brand'}`}>{icons.dark}</div>
      </button>
    </div>
  );
}