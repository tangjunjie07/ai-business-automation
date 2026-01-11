'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn, AlertCircle, ArrowLeft } from 'lucide-react'
import ChatInterface from '@/components/chat-interface'

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  // ローディング中
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 未ログインの場合
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">アクセス権限が必要です</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-gray-600 leading-relaxed">
              このページにアクセスするにはログインが必要です。
            </p>
            <Button asChild className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
              <a href="/auth/signin" className="flex items-center justify-center">
                <LogIn className="h-5 w-5 mr-2" />
                ログインする
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.push('/dashboard')} className="p-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">AIアシスタント</h1>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{session.user?.name || session.user?.email}</p>
              <p className="text-xs text-gray-500">{session.user?.tenantName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 説明セクション */}
        <div className="mb-8">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl">ドキュメント分析チャット</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  AIアシスタントがアップロードしたドキュメントを分析し、質問に答えます。
                  業務効率化のための強力なツールです。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span>PDF、Word、Excel対応</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span>日本語・英語対応</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    <span>リアルタイム分析</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* チャットインターフェース */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <ChatInterface />
          </CardContent>
        </Card>

        {/* フッター */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2026 AI業務自動化プラットフォーム - テナント: {session.user.tenantName}</p>
        </div>
      </div>
    </div>
  )
}