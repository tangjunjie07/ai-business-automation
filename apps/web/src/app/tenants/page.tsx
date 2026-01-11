'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn, AlertCircle, Building, Plus, ArrowLeft, Users, Calendar, Globe } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Tenant {
  id: string
  name: string
  domain: string
  createdAt: string
  userCount: number
}

export default function TenantsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false)
  const [newTenant, setNewTenant] = useState({
    name: '',
    domain: ''
  })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // スーパー管理者権限チェック（仮定）
    if (session.user.role !== 'super_admin') {
      router.push('/dashboard')
      return
    }

    fetchTenants()
  }, [session, status, router])

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants')

      if (response.ok) {
        const data = await response.json()
        setTenants(data.tenants)
      }
    } catch (error) {
      console.error('Error fetching tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTenant = async () => {
    if (!newTenant.name || !newTenant.domain) {
      alert('全てのフィールドを入力してください')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTenant),
      })

      if (response.ok) {
        setNewTenant({ name: '', domain: '' })
        setIsCreateTenantOpen(false)
        fetchTenants() // テナントリストを更新
      } else {
        const error = await response.json()
        alert(error.error || 'テナント作成に失敗しました')
      }
    } catch (error) {
      console.error('Error creating tenant:', error)
      alert('テナント作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

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

  // スーパー管理者権限がない場合
  if (session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">スーパー管理者権限が必要です</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-gray-600 leading-relaxed">
              このページにアクセスするにはスーパー管理者権限が必要です。
            </p>
            <Button asChild className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
              <a href="/dashboard" className="flex items-center justify-center">
                ダッシュボードに戻る
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
              <h1 className="text-2xl font-bold text-gray-900">テナント管理</h1>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{session.user.name || session.user.email}</p>
              <p className="text-xs text-gray-500">スーパー管理者</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダーセクション */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">テナント管理</h2>
            <p className="text-lg text-gray-600">
              システム全体のテナントを管理します
            </p>
          </div>
          <Dialog open={isCreateTenantOpen} onOpenChange={setIsCreateTenantOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg hover:shadow-xl transition-all duration-200">
                <Plus className="h-5 w-5 mr-2" />
                新規テナント作成
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  新規テナント作成
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">テナント名</Label>
                  <Input
                    id="name"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                    placeholder="テナント名"
                  />
                </div>
                <div>
                  <Label htmlFor="domain">ドメイン</Label>
                  <Input
                    id="domain"
                    value={newTenant.domain}
                    onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                    placeholder="example.com"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreateTenantOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={createTenant} disabled={isCreating} className="min-w-20">
                    {isCreating ? '作成中...' : '作成'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
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
                  <p className="text-2xl font-bold text-gray-900">
                    {tenants.reduce((sum, tenant) => sum + tenant.userCount, 0)}
                  </p>
                  <p className="text-sm text-gray-600">総ユーザー数</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mr-4">
                  <Globe className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {tenants.filter(t => t.domain).length}
                  </p>
                  <p className="text-sm text-gray-600">ドメイン設定済み</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* テナントリスト */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="h-5 w-5 mr-2" />
              テナント一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">読み込み中...</p>
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">テナントが見つかりません</p>
                <p className="text-gray-500 text-sm">新規テナントを作成してください</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Building className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{tenant.name}</p>
                        <p className="text-sm text-gray-600 flex items-center">
                          <Globe className="h-4 w-4 mr-1" />
                          {tenant.domain || 'ドメイン未設定'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Users className="h-3 w-3 mr-1" />
                          {tenant.userCount} ユーザー
                        </span>
                        <p className="text-xs text-gray-500 mt-1 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(tenant.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}