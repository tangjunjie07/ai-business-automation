'use client'

import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn, AlertCircle } from 'lucide-react'
import ChatInterface from '../../components/chat-interface'
import TenantForm from '../../components/tenant-form'
import UserForm from '../../components/user-form'

export default function Dashboard() {
  const { data: session, status } = useSession()

  // ローディング中
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 未ログインの場合
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">アクセス権限が必要です</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              このページにアクセスするにはログインが必要です。
            </p>
            <Button asChild className="w-full">
              <a href="/auth/signin">
                <LogIn className="h-4 w-4 mr-2" />
                ログインする
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderDashboardContent = () => {
    switch (session.user.role) {
      case 'super_admin':
        return (
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>スーパー管理者ダッシュボード</CardTitle>
              </CardHeader>
              <CardContent>
                <TenantForm />
              </CardContent>
            </Card>
          </div>
        )
      case 'admin':
        return (
          <div className="max-w-4xl mx-auto space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>管理者ダッシュボード</CardTitle>
              </CardHeader>
              <CardContent>
                <UserForm />
              </CardContent>
            </Card>
            <ChatInterface
              messages={[]}
              onSendMessage={() => {}}
              isLoading={false}
            />
          </div>
        )
      case 'user':
      default:
        return (
          <div className="max-w-4xl mx-auto">
            <ChatInterface
              messages={[]}
              onSendMessage={() => {}}
              isLoading={false}
            />
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI業務自動化アシスタント</h1>
            <p className="text-gray-600">請求書をアップロードして、AIが自動で勘定科目を分析します</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">こんにちは、{session.user.name || session.user.email}</span>
            <Button variant="outline" onClick={() => signOut()}>
              ログアウト
            </Button>
          </div>
        </div>

        {renderDashboardContent()}
      </div>
    </div>
  )
}