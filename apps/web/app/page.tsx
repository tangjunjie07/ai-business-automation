'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROUTES, ROLES } from '@/config'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push(ROUTES.SIGNIN)
    } else {
      const role = session.user?.role
      if (role === ROLES.SUPER_ADMIN) {
        router.push(ROUTES.SUPER_ADMIN_DASHBOARD)
      } else if (role === ROLES.ADMIN) {
        router.push(ROUTES.DASHBOARD)
      } else {
        router.push(ROUTES.CHAT)
      }
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return null
}
