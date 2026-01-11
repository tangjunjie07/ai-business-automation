'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '../../../config'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { LogIn } from 'lucide-react'

export default function SuperAdminSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (process.env.NODE_ENV === 'development') console.debug('SIGNIN RESULT:', { ok: result?.ok, status: result?.status })
      if (result?.error || result?.status === 401 || result?.ok === false) {
        setError('ログイン情報が正しくありません')
        return
      }
      router.push(ROUTES.SUPER_ADMIN_DASHBOARD)
    } catch (error) {
      setError('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-purple-500/10 rounded-full blur-xl animate-pulse delay-500"></div>

      <div className="relative z-10 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Header Section */}
          <div className="text-center mb-10">
            <div className="mx-auto mb-8 h-20 w-20 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/25">
              <LogIn className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
              システム管理者
            </h1>
            <p className="text-xl text-blue-100 font-medium">
              プラットフォーム全体を管理
            </p>
            <div className="mt-4 h-1 w-24 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full mx-auto"></div>
          </div>

          {/* Login Card */}
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl shadow-black/20">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-center text-white font-semibold">
                管理者認証
              </CardTitle>
              <p className="text-center text-blue-100 text-sm">
                システム管理権限でログインしてください
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    メールアドレス
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="superadmin@example.com"
                      className="h-12 bg-white/5 border-white/20 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400 transition-all duration-200 pl-4 pr-4 rounded-lg backdrop-blur-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                    パスワード
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="パスワードを入力"
                      className="h-12 bg-white/5 border-white/20 text-white placeholder:text-blue-200 focus:border-indigo-400 focus:ring-indigo-400 transition-all duration-200 pl-4 pr-4 rounded-lg backdrop-blur-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-400/50 rounded-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                      <p className="text-red-100 text-sm font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl hover:shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      <span>認証中...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <LogIn className="h-6 w-6" />
                      <span>ログイン</span>
                    </div>
                  )}
                </Button>
              </form>

              {/* Footer Link */}
              <div className="pt-6 border-t border-white/10">
                <p className="text-center text-sm text-blue-100">
                  通常ユーザー・テナント管理者は{' '}
                  <a
                    href={ROUTES.SIGNIN}
                    className="text-blue-300 hover:text-white font-semibold hover:underline transition-colors duration-200"
                  >
                    こちらからログイン
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-blue-200/60">
              © 2024 AI業務自動化プラットフォーム. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
