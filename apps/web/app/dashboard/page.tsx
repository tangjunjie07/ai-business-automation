"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ROUTES, ROLES } from '@/config'

interface User {
  id: string
  name: string | null
  email: string
  role: string
}

// Chat interfaces moved to /chat page

import ThreeColLayout from '../components/three-col-layout'

export default function Dashboard() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Chat states - REMOVED: Chat functionality moved to dedicated /chat page

  useEffect(() => {
    if (session?.user) {
      fetchUsers()
    }
  }, [session])

  // WebSocket connection for progress updates - REMOVED: Moved to /chat page

  // handleProgressEvent - REMOVED: Moved to /chat page

  useEffect(() => {
    if (session?.user) {
      fetchUsers()
    }
  }, [session])

  const fetchUsers = async () => {
    const res = await fetch('/api/users', {
      headers: {
        'x-tenant-id': session?.user?.tenantId || ''
      }
    })
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users || [])
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': session?.user?.tenantId || ''
        },
        body: JSON.stringify(newUser)
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '作成失敗')
        toast.error(data.error || '作成失敗')
      } else {
        setNewUser({ name: '', email: '', password: '' })
        toast.success('ユーザーを作成しました')
        fetchUsers()
      }
    } catch (e) {
      setError('通信エラー')
      toast.error('通信エラー')
    } finally {
      setLoading(false)
    }
  }

  // handleSendMessage - REMOVED: Moved to /chat page

  // File handling functions - REMOVED: Moved to /chat page

  return (
    <ThreeColLayout
      left={(
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">ダッシュボード</h1>
              <p className="text-sm text-[color:var(--muted)]">テナント: {session?.user?.tenantName || '—'}</p>
            </div>
            <div className="flex items-center gap-3" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[color:var(--muted)]">アップロード済みドキュメント</p>
                    <p className="text-2xl font-semibold">—</p>
                  </div>
                  <div className="text-[color:var(--brand)] font-bold text-xl">📄</div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[color:var(--muted)]">解析ジョブ（進行中）</p>
                    <p className="text-2xl font-semibold">—</p>
                  </div>
                  <div className="text-[color:var(--brand)] font-bold text-xl">⚙️</div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[color:var(--muted)]">アクティブユーザー</p>
                    <p className="text-2xl font-semibold">{users.length}</p>
                  </div>
                  <div className="text-[color:var(--brand)] font-bold text-xl">👥</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {session?.user?.role === ROLES.ADMIN && (
              <Card>
                <CardHeader>
                  <CardTitle>ユーザー作成</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <Label>名前</Label>
                      <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                    </div>
                    <div>
                      <Label>メール</Label>
                      <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                    </div>
                    <div>
                      <Label>パスワード</Label>
                      <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                    </div>
                    <div>
                      <Button type="submit" disabled={loading} className="w-full">
                        {loading ? '作成中...' : 'ユーザー作成'}
                      </Button>
                      {error && <p className="text-red-500 mt-2">{error}</p>}
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>AIチャット</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[color:var(--muted)] mb-4">ドキュメントとの対話や解析結果の照会はこちら。</p>
                <Button asChild className="w-full">
                  <a href={ROUTES.CHAT}>AIチャットページへ移動</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    >
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>ユーザー一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {users.map(u => (
                <li key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{u.name || u.email}</div>
                    <div className="text-sm text-[color:var(--muted)]">{u.email} — {u.role}</div>
                  </div>
                  <div className="text-sm text-[color:var(--muted)]">{u.id}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </ThreeColLayout>
  )
}
