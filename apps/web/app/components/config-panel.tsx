import React from 'react';
export function ConfigPanel({ onAction, onClose }: { onAction?: (msg: string) => void; onClose?: () => void }) {
  const stats = {
    totalAmount: "¥1,280,000",
    paymentSchedule: "12件",
    needsAction: "3件"
  };
  const [selectedMonth, setSelectedMonth] = React.useState("2026-01");
  // 年月選択用のリスト生成
  const years = [2025, 2026, 2027];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto min-h-0 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button type="button" className="p-2 action-btn action-btn-l" onClick={() => onClose?.()} aria-label="close-right-panel">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="remixicon h-[18px] w-[18px]"><path d="M21 3C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H21ZM20 5H4V19H20V5ZM18 7V17H16V7H18Z"></path></svg>
          </button>
          <div className="text-sm font-medium text-text-secondary">ダッシュボード</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={selectedMonth.split('-')[0]}
          onChange={e => setSelectedMonth(e.target.value + '-' + selectedMonth.split('-')[1])}
        >
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={selectedMonth.split('-')[1]}
          onChange={e => setSelectedMonth(selectedMonth.split('-')[0] + '-' + e.target.value)}
        >
          {months.map(m => <option key={m} value={String(m).padStart(2, '0')}>{m}月</option>)}
        </select>
        <span className="text-sm font-bold text-gray-500">月次サマリー</span>
      </div>
      <button
        onClick={() => onAction?.(`${selectedMonth}の請求金額明細を表示してください`)}
        className="flex flex-col items-start p-4 bg-chat-bubble-bg dark:bg-chat-bubble-bg border border-components-panel-border dark:border-components-panel-border rounded-xl hover:shadow-md transition shadow-sm"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <span className="text-xs text-text-tertiary">当月請求金額</span>
        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.totalAmount}</span>
      </button>

      <button
        onClick={() => onAction?.(`${selectedMonth}の支払予定表を表示してください`)}
        className="flex flex-col items-start p-4 bg-chat-bubble-bg dark:bg-chat-bubble-bg border border-components-panel-border dark:border-components-panel-border rounded-xl hover:shadow-md transition shadow-sm"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <span className="text-xs text-text-tertiary">当月請求金額</span>
        <span className="text-xl font-bold text-green-600 dark:text-green-400">{stats.paymentSchedule}</span>
      </button>

      <button
        onClick={() => onAction?.(`${selectedMonth}の要確認の異常請求一覧を表示してください`)}
        className="flex flex-col items-start p-4 bg-orange-50 dark:bg-chat-bubble-bg border border-orange-200 dark:border-components-panel-border rounded-xl hover:shadow-md transition shadow-sm"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <span className="text-xs text-orange-500">要確認情報</span>
        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.needsAction}</span>
      </button>
    </div>
  );
}