'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

export default function TenantForm() {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    countryCode: 'JP',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // align with API fields
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          countryCode: formData.countryCode,
          adminEmail: formData.adminEmail,
          adminName: formData.adminName,
          adminPassword: formData.adminPassword,
        }),
      })

      if (response.ok) {
        toast.success('テナントと管理者を作成しました')
        setFormData({
          name: '',
          domain: '',
          countryCode: 'JP',
          adminEmail: '',
          adminName: '',
          adminPassword: '',
        })
      } else {
        const error = await response.json()
        toast.error(error.message || '作成に失敗しました')
      }
    } catch (error) {
      toast.error('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新規テナント作成</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="domain">テナントコード (ドメイン)</Label>
              <Input
                id="domain"
                name="domain"
                value={formData.domain}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="name">テナント名</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="countryCode">国コード</Label>
            <Input
              id="countryCode"
              name="countryCode"
              value={formData.countryCode}
              onChange={handleChange}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="adminEmail">管理者メールアドレス</Label>
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="adminName">管理者名</Label>
              <Input
                id="adminName"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="adminPassword">管理者パスワード</Label>
            <Input
              id="adminPassword"
              name="adminPassword"
              type="password"
              value={formData.adminPassword}
              onChange={handleChange}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? '作成中...' : 'テナントと管理者を作成'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}