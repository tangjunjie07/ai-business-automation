import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import Link from 'next/link'
import Header from './components/header'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AI業務自動化プラットフォーム',
  description: 'AIを活用した経理・業務自動化プラットフォーム',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[color:var(--background)] text-[color:var(--foreground)]`}> 
        <Providers>
          <div className="min-h-screen flex flex-col">
            <header className="border-b bg-white/80 dark:bg-black/70 backdrop-blur-sm">
              <Header />
            </header>

            <main className="flex-1 w-full">
              <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
            </main>

            <footer className="border-t text-xs text-gray-500 dark:text-gray-400 bg-transparent">
              <div className="max-w-6xl mx-auto px-4 py-4">© {new Date().getFullYear()} AI業務自動化</div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
