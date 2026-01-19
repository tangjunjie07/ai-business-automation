import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './pages/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'chatbot-bg': 'var(--color-chatbot-bg)',
        'chat-bubble-bg': 'var(--color-chat-bubble-bg)',
        'chat-input-mask': 'var(--color-chat-input-mask)',
      },
      colors: {
        'state-base-active': 'var(--color-state-base-active)',
        'state-base-hover': 'var(--color-state-base-hover)',
        'text-accent': 'var(--color-text-accent)',
      },
    },
  },
  plugins: [typography],
}

export default config
