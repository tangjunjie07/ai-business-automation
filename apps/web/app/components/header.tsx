"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, Grid, MessageSquare, Upload, Users, LogOut } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { ROUTES, ROLES, isNormalUser } from '@/config'

type RoleValue = (typeof ROLES)[keyof typeof ROLES]

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: RoleValue[]
}

function Header() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const { data: session, status } = useSession()

  const nav: NavItem[] = [
    { href: ROUTES.DASHBOARD, label: 'ダッシュボード', icon: Grid, roles: [ROLES.ADMIN] },
    { href: ROUTES.CHAT, label: 'チャット', icon: MessageSquare, roles: [ROLES.ADMIN, ROLES.USER] },
  ]

  if (status === 'loading') return null;

  if (pathname.startsWith('/auth')) return null;

  const logoutTarget = (pathname.startsWith('/super-admin') || session?.user?.role === ROLES.SUPER_ADMIN) ? ROUTES.SUPER_ADMIN_SIGNIN : ROUTES.SIGNIN

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold">AI業務自動化</Link>

        <nav className="hidden sm:flex gap-3">
          {nav
            .filter((n) => {
              if (!n.roles) return true
              const role = session?.user?.role as string | undefined
              const isNormal = isNormalUser(role)
              if (role && n.roles.includes(role as RoleValue)) return true
              if (n.roles.includes(ROLES.USER)) return isNormal
              return false
            })
            .map((n) => {
              const ActiveIcon = n.icon
              const isActive = pathname.startsWith(n.href)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-[color:var(--brand)] text-white' : 'text-[color:var(--muted)] hover:bg-[color:var(--surface)]'}`}
                >
                  <ActiveIcon className="h-4 w-4" />
                  <span>{n.label}</span>
                </Link>
              )
            })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {session?.user?.role === ROLES.SUPER_ADMIN && (
          <Link href={ROUTES.SUPER_ADMIN_DASHBOARD} className="hidden sm:inline p-2 rounded-md text-sm text-[color:var(--muted)] hover:bg-[color:var(--surface)]">
            <Users className="inline-block h-4 w-4 mr-2 align-text-top" /> 管理
          </Link>
        )}

        {session ? (
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="h-8 w-8 rounded-full bg-[color:var(--brand)] text-white flex items-center justify-center text-sm font-semibold">
                {(() => {
                  const name = session.user?.name || session.user?.email || ''
                  const parts = name.split(' ')
                  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
                  return name.slice(0, 2).toUpperCase()
                })()}
              </div>
              <div className="text-sm text-[color:var(--muted)] max-w-[10rem] truncate">{session.user?.name || session.user?.email}</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: logoutTarget })} className="p-2 rounded-md hover:bg-[color:var(--surface)]" title="ログアウト">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link href={ROUTES.SIGNIN} className="hidden sm:inline text-sm text-[color:var(--brand)]">サインイン</Link>
        )}

        <button
          aria-label="メニュー"
          className="sm:hidden p-2 rounded-md bg-transparent"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden absolute left-4 right-4 top-14 bg-[color:var(--surface)] rounded-md shadow-lg p-3 z-50">
          <div className="border-b pb-3 mb-3">
            {session ? (
              <div>
                <div className="font-medium">{session.user?.name || session.user?.email}</div>
                {session.user?.tenantName && <div className="text-sm text-[color:var(--muted)]">{session.user.tenantName}</div>}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">未ログイン</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {nav
              .filter((n) => {
                if (!n.roles) return true
                const role = session?.user?.role as string | undefined
                const isNormal = isNormalUser(role)
                if (role && n.roles.includes(role as RoleValue)) return true
                if (n.roles.includes(ROLES.USER)) return isNormal
                return false
              })
              .map((n) => {
                const ActiveIcon = n.icon
                const isActive = pathname.startsWith(n.href)
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-[color:var(--brand)] text-white' : 'text-[color:var(--foreground)] hover:bg-[color:var(--surface)]'}`}
                  >
                    <ActiveIcon className="h-4 w-4" />
                    <span>{n.label}</span>
                  </Link>
                )
              })}
            {session?.user?.role === ROLES.SUPER_ADMIN && (
              <Link href={ROUTES.SUPER_ADMIN_DASHBOARD} onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-[color:var(--muted)] hover:bg-[color:var(--surface)]">管理</Link>
            )}
            {session ? (
              <button onClick={() => { setOpen(false); const logoutTarget = (pathname.startsWith('/super-admin') || session?.user?.role === ROLES.SUPER_ADMIN) ? ROUTES.SUPER_ADMIN_SIGNIN : ROUTES.SIGNIN; signOut({ callbackUrl: logoutTarget }) }} className="w-full text-left px-3 py-2 rounded-md text-sm text-[color:var(--foreground)] hover:bg-[color:var(--surface)]">ログアウト</button>
            ) : (
              <Link href={ROUTES.SIGNIN} onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-[color:var(--brand)] hover:bg-[color:var(--surface)]">サインイン</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Header;