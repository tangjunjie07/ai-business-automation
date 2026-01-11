'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROUTES } from '../../config'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { LogIn, AlertCircle, ArrowLeft } from 'lucide-react'
import ChatInterface from '@/components/chat-interface'

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push(ROUTES.SIGNIN)
    }
  }, [session, status, router])

  // ローディング中
  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 未ログインの場合
  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900">アクセス権限が必要です</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600 leading-relaxed">
              このページにアクセスするにはログインが必要です。
            </p>
            <Button asChild className="w-full h-12 text-lg font-semibold shadow transition-all duration-150">
              <a href={ROUTES.SIGNIN} className="flex items-center justify-center">
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 説明セクション */}
      <div className="mb-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">ドキュメント分析チャット</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              AIアシスタントがアップロードしたドキュメントを分析し、質問に答えます。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* チャットインターフェース */}
      <Card className="shadow">
        <CardContent className="p-4">
          <ChatInterface />
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-gray-500 text-center">© {new Date().getFullYear()} AI業務自動化プラットフォーム - テナント: {session.user?.tenantName}</div>
    </div>
  )
}
