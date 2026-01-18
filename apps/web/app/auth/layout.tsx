
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '../globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ログイン | AI業務自動化プラットフォーム',
  description: 'ログイン画面',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[color:var(--background)] dark:bg-[#18181c] text-[color:var(--foreground)] h-screen min-h-screen transition-colors duration-300`}>
      {children}
    </div>
  )
}
