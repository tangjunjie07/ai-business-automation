"use client";
import React, { useState } from 'react';
import { Menu, PanelRightClose, PanelRightOpen, SidebarClose, SidebarOpen } from 'lucide-react';

export default function ChatLayout() {
  const [isLeftOpen, setIsLeftOpen] = useState(false); // デフォルト非表示
  const [isRightOpen, setIsRightOpen] = useState(false); // デフォルト非表示

  return (
    <div className="flex h-screen bg-chatbot-bg overflow-hidden">
      {/* --- 左サイドバー --- */}
      <aside className={`bg-chatbot-bg border-r transition-all duration-300 ${isLeftOpen ? 'w-64' : 'w-0'} overflow-hidden relative`}>
        <div className="w-64 p-4">
          <h2 className="font-bold mb-4">履歴</h2>
          {/* 履歴リスト例 */}
          <div className="space-y-2">
            <div className="p-2 text-sm bg-chat-bubble-bg rounded shadow-sm border-l-4 border-blue-500 cursor-pointer">1月17日 交通費請求書解析...</div>
            <div className="p-2 text-sm text-text-tertiary hover:bg-state-base-hover rounded cursor-pointer transition">1月15日 オフィス用品精算...</div>
          </div>
        </div>
      </aside>

      {/* --- 中央チャットエリア --- */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* ヘッダー: サイドバー開閉ボタン */}
        <header className="h-14 border-b flex items-center px-4 justify-between bg-chatbot-bg z-10">
          <button onClick={() => setIsLeftOpen(!isLeftOpen)} className="p-2 hover:bg-state-base-hover rounded">
            {isLeftOpen ? <SidebarClose size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="font-medium">AI経理アシスタント</h1>
          <button onClick={() => setIsRightOpen(!isRightOpen)} className="p-2 hover:bg-state-base-hover rounded">
            {isRightOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        </header>
        {/* チャット内容エリア */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">AI: 何かお手伝いしましょうか？</div>
            {/* ここにチャット内容を追加 */}
          </div>
        </div>
        {/* 入力欄 */}
        <footer className="p-4 bg-chatbot-bg border-t">
          <div className="max-w-4xl mx-auto w-full">
            <div className="border rounded-xl p-2 focus-within:ring-2 ring-blue-500 shadow-sm">
              <textarea className="w-full resize-none outline-none p-2" placeholder="メッセージを入力..." rows={3} />
            </div>
          </div>
        </footer>
      </main>

      {/* --- 右サイドパネル --- */}
      <aside className={`bg-gray-50 border-l transition-all duration-300 ${isRightOpen ? 'w-80' : 'w-0'} overflow-hidden`}>
        <div className="w-80 p-6">
          <h2 className="font-bold text-gray-500 mb-6 text-sm uppercase">ダッシュボード</h2>
          {/* ここに統計ボタン等を追加 */}
        </div>
      </aside>
    </div>
  );
}
