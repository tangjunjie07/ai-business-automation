import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[color:var(--background)] dark:bg-[#18181c] text-[color:var(--foreground)] h-screen min-h-screen transition-colors duration-300`}>
        <Providers>
          <div className="flex flex-col h-screen min-h-screen relative">
            <header className="border-b bg-chatbot-bg/80 dark:bg-black/70 backdrop-blur-sm">
              <Header />
            </header>
            <main className="flex-1 w-full relative min-h-0">
              <div className="max-w-6xl mx-auto px-4 py-6 h-full min-h-0 relative">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
