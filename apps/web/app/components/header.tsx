'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { ROUTES, ROLES, isNormalUser } from '@/config'
import { Menu, X, Grid, MessageSquare } from 'lucide-react'

const nav = [
  { href: ROUTES.DASHBOARD, label: 'ダッシュボード', icon: Grid, roles: [ROLES.ADMIN] },
  { href: ROUTES.CHAT, label: 'チャット', icon: MessageSquare, roles: [ROLES.ADMIN, ROLES.USER] },
]

export function Header() {
  const [x, setX] = useState(0)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    console.log('Header mounted')
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  if (status === 'loading') return null
  if (pathname.startsWith('/auth')) return null
  const userInitials = (() => {
    const name = session?.user?.name || session?.user?.email || ''
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  })()
  return (
    <div ref={ref} className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <Link href="/" className="text-lg font-semibold">AI業務自動化</Link>
      <nav className="hidden sm:flex gap-3">
        {nav
          .filter((n) => {
            if (!n.roles) return true
            const role = session?.user?.role as string | undefined
            const isNormal = isNormalUser(role)
            if (role && n.roles.includes(role as any)) return true
            if (n.roles.includes(ROLES.USER)) return isNormal
            return false
          })
          .map((n) => {
            const Icon = n.icon
            const isActive = pathname.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            )
          })}
      </nav>
      <div className="flex items-center gap-3">
        {session?.user?.role === ROLES.SUPER_ADMIN && (
          <Link href={ROUTES.SUPER_ADMIN_DASHBOARD} className="hidden sm:inline p-2 rounded-md text-sm text-gray-600 hover:bg-gray-100">
            管理
          </Link>
        )}
        {session && (
          <button onClick={() => {
            const logoutTarget = (pathname.startsWith('/super-admin') || session?.user?.role === ROLES.SUPER_ADMIN) ? ROUTES.SUPER_ADMIN_SIGNIN : ROUTES.SIGNIN
            signOut({ callbackUrl: logoutTarget })
          }} className="hidden sm:inline text-sm text-gray-600 hover:bg-gray-100 px-2 py-1 rounded-md">
            ログアウト
          </button>
        )}
        {session && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
              {userInitials}
            </div>
            <div className="text-sm text-gray-600">{session.user?.name}</div>
          </div>
        )}
        <button onClick={() => setOpen(!open)} className="sm:hidden p-2 rounded-md">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="sm:hidden absolute left-4 right-4 top-14 bg-white rounded-md shadow-lg p-3 z-50">
          <div className="border-b pb-3 mb-3">
            {session ? (
              <div>
                <div className="font-medium">{session.user?.name || session.user?.email}</div>
                {session.user?.tenantName && <div className="text-sm text-gray-600">{session.user.tenantName}</div>}
              </div>
            ) : (
              <div className="text-sm text-gray-600">未ログイン</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {nav
              .filter((n) => {
                if (!n.roles) return true
                const role = session?.user?.role as string | undefined
                const isNormal = isNormalUser(role)
                if (role && n.roles.includes(role as any)) return true
                if (n.roles.includes(ROLES.USER)) return isNormal
                return false
              })
              .map((n) => {
                const Icon = n.icon
                const isActive = pathname.startsWith(n.href)
                return (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                )
              })}
            {session?.user?.role === ROLES.SUPER_ADMIN && (
              <Link href={ROUTES.SUPER_ADMIN_DASHBOARD} onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100">管理</Link>
            )}
            {session ? (
              <button onClick={() => { setOpen(false); const logoutTarget = (pathname.startsWith('/super-admin') || session?.user?.role === ROLES.SUPER_ADMIN) ? ROUTES.SUPER_ADMIN_SIGNIN : ROUTES.SIGNIN; signOut({ callbackUrl: logoutTarget }) }} className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100">
                ログアウト
              </button>
            ) : (
              <Link href={ROUTES.SIGNIN} onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-blue-500 hover:bg-gray-100">
                サインイン
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
