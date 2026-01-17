'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { useSession, signIn } from 'next-auth/react'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function Providers({ children }: { children: React.ReactNode }) {
  function SessionWatcher() {
    const { status } = useSession()
    const pathname = usePathname()

    useEffect(() => {
      // If session becomes unauthenticated, redirect to sign-in unless already on auth pages
      if (status === 'unauthenticated' && pathname && !pathname.startsWith('/auth')) {
        // `signIn` will navigate to the configured sign in page
        signIn()
      }
    }, [status, pathname])

    return null
  }

  return (
    <SessionProvider>
      {children}
      <SessionWatcher />
      <Toaster />
    </SessionProvider>
  )
}
