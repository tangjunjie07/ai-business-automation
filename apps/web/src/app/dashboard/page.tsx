'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn, AlertCircle, Users, Building, MessageSquare, BarChart3, Settings, ChevronRight, Shield, Globe } from 'lucide-react'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    tenantUsers: 0,
    adminUsers: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) return

    fetchStats()
  }, [session, status])

  const fetchStats = async () => {
    try {
      if (session!.user.role === 'super_admin') {
        // システム管理者の場合、全ての統計を取得
        const tenantsResponse = await fetch('/api/tenants')
        const usersResponse = await fetch('/api/users', {
          headers: { 'x-tenant-id': session!.user.tenantId }
        })

        if (tenantsResponse.ok && usersResponse.ok) {
          const tenantsData = await tenantsResponse.json()
          const usersData = await usersResponse.json()

          setStats({
            totalTenants: tenantsData.tenants.length,
            totalUsers: usersData.users.length,
            tenantUsers: 0,
            adminUsers: 0
          })
        }
      } else if (session!.user.role === 'admin') {
        // テナント管理者の場合、自分のテナントの統計を取得
        const usersResponse = await fetch('/api/users', {
          headers: { 'x-tenant-id': session!.user.tenantId }
        })

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setStats({
            totalTenants: 0,
            totalUsers: 0,
            tenantUsers: usersData.users.length,
            adminUsers: usersData.users.filter((u: any) => u.role === 'admin').length
          })
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
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
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">AI業務自動化プラットフォーム</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{session.user.name || session.user.email}</p>
                <p className="text-xs text-gray-500">{session.user.tenantName} ({session.user.tenantCode})</p>
              </div>
              <Button variant="outline" onClick={() => signOut()} className="shadow-sm">
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ウェルカムメッセージ */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            ようこそ、{session.user.name || 'ユーザー'}さん
          </h2>
          <p className="text-lg text-gray-600">
            AIを活用した業務自動化で、効率的な業務運営を実現しましょう
          </p>
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {session.user.role !== 'super_admin' ? (
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  AIアシスタント
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">ドキュメントを分析して質問に答えます</p>
                <Button asChild className="w-full group-hover:bg-blue-600 transition-colors">
                  <a href="/chat" className="flex items-center justify-center">
                    チャットを開始
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md opacity-60 cursor-not-allowed">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                    <MessageSquare className="h-5 w-5 text-blue-300" />
                  </div>
                  AIアシスタント (利用不可)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">システム管理者はAIチャット機能を利用できません。</p>
              </CardContent>
            </Card>
          )}

          {session.user.role === 'admin' && (
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center mr-3 group-hover:bg-green-200 transition-colors">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  ユーザー管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">ユーザーの作成・管理を行います</p>
                <Button asChild variant="outline" className="w-full group-hover:bg-green-50 transition-colors">
                  <a href="/users" className="flex items-center justify-center">
                    ユーザー管理
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {session.user.role === 'super_admin' && (
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3 group-hover:bg-purple-200 transition-colors">
                    <Building className="h-5 w-5 text-purple-600" />
                  </div>
                  テナント管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">テナントの作成・管理を行います</p>
                <Button asChild variant="outline" className="w-full group-hover:bg-purple-50 transition-colors">
                  <a href="/tenants" className="flex items-center justify-center">
                    テナント管理
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 統計情報 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">統計情報</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {session.user.role === 'super_admin' && (
              <>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
                        <Building className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalTenants}</p>
                        <p className="text-sm text-gray-600">総テナント数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mr-4">
                        <Users className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                        <p className="text-sm text-gray-600">総ユーザー数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {session.user.role === 'admin' && (
              <>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mr-4">
                        <Users className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.tenantUsers}</p>
                        <p className="text-sm text-gray-600">テナントユーザー数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mr-4">
                        <Shield className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.adminUsers}</p>
                        <p className="text-sm text-gray-600">管理者数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {session.user.role === 'user' && (
              <Card className="border-0 shadow-md md:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
                      <MessageSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">AIチャット機能</p>
                      <p className="text-sm text-gray-600">ビジネス自動化のためのAIアシスタントをご利用いただけます</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                現在のステータス
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">ロール:</span>
                  <span className="font-medium">{session.user.role === 'admin' ? '管理者' : 'ユーザー'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">テナント:</span>
                  <span className="font-medium">{session.user.tenantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ステータス:</span>
                  <span className="font-medium text-green-600">アクティブ</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Settings className="h-5 w-5 mr-2 text-gray-600" />
                クイック設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/profile">
                    <Settings className="h-4 w-4 mr-2" />
                    プロフィール設定
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    システム設定
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">最近のアクティビティ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• ログインしました</p>
                <p>• システムにアクセスしました</p>
                <p>• ダッシュボードを表示しました</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}