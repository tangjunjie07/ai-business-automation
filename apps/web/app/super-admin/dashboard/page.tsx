"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import toast from 'react-hot-toast'

interface Tenant {
  id: string
  name: string
  code: string
  adminEmail: string
}

interface User {
  id: string
  name: string | null
  email: string
  role: string
  tenantCode?: string
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [newTenant, setNewTenant] = useState({ name: '', code: '', adminEmail: '', adminPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTenants()
    fetchUsers()
  }, [])

  const fetchTenants = async () => {
    const res = await fetch('/api/super-admin/tenants', {
      headers: {
        'x-tenant-id': '0'
      }
    })
    if (res.ok) {
      setTenants(await res.json())
    }
  }
  const fetchUsers = async () => {
    const res = await fetch('/api/super-admin/users', {
      headers: {
        'x-tenant-id': '0'
      }
    })
    if (res.ok) {
      setUsers(await res.json())
    }
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': '0'
        },
        body: JSON.stringify(newTenant)
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '作成失敗')
        toast.error(data.error || '作成失敗')
      } else {
        setNewTenant({ name: '', code: '', adminEmail: '', adminPassword: '' })
        toast.success('テナントを作成しました')
        fetchTenants()
        fetchUsers()
      }
    } catch (e) {
      setError('通信エラー')
      toast.error('通信エラー')
    } finally {
      setLoading(false)
    }
  }

  import ThreeColLayout from '../../components/three-col-layout'

  return (
    <ThreeColLayout
      left={(
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">システム管理ダッシュボード</h1>
              <p className="text-sm text-[color:var(--muted)]">全テナントとユーザーの管理</p>
            </div>
            <div />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[color:var(--muted)]">テナント数</p>
                    <p className="text-2xl font-semibold">{tenants.length}</p>
                  </div>
                  <div className="text-[color:var(--brand)] font-bold text-xl">🏢</div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[color:var(--muted)]">システム管理者</p>
                    <p className="text-2xl font-semibold">—</p>
                  </div>
                  <div className="text-[color:var(--brand)] font-bold text-xl">🔑</div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[color:var(--muted)]">全ユーザー</p>
                    <p className="text-2xl font-semibold">{users.length}</p>
                  </div>
                  <div className="text-[color:var(--brand)] font-bold text-xl">👥</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>テナント作成</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTenant} className="space-y-4">
                <div>
                  <Label>テナント名</Label>
                  <Input value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} required />
                </div>
                <div>
                  <Label>テナントコード</Label>
                  <Input value={newTenant.code} onChange={e => setNewTenant({ ...newTenant, code: e.target.value })} required />
                </div>
                <div>
                  <Label>管理者メール</Label>
                  <Input type="email" value={newTenant.adminEmail} onChange={e => setNewTenant({ ...newTenant, adminEmail: e.target.value })} required />
                </div>
                <div>
                  <Label>管理者パスワード</Label>
                  <Input type="password" value={newTenant.adminPassword} onChange={e => setNewTenant({ ...newTenant, adminPassword: e.target.value })} required />
                </div>
                <div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? '作成中...' : 'テナント作成'}</Button>
                  {error && <p className="text-red-500 mt-2">{error}</p>}
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    >
      <div className="lg:col-span-2">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>テナント一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {tenants.map(t => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.name} <span className="text-[color:var(--muted)]">({t.code})</span></div>
                    <div className="text-sm text-[color:var(--muted)]">管理者: {t.adminEmail}</div>
                  </div>
                  <div className="text-sm text-[color:var(--muted)]">ID: {t.id}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>全ユーザー一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {users.map(u => (
                <li key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{u.name || u.email}</div>
                    <div className="text-sm text-[color:var(--muted)]">{u.email} — {u.role}</div>
                  </div>
                  <div className="text-sm text-[color:var(--muted)]">{u.tenantCode || 'システム管理者'}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </ThreeColLayout>
  )
}
