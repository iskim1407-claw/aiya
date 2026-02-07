import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '아이야 - 아이 음성 비서',
  description: '2~4세 유아를 위한 한국어 음성 비서',
  viewport: 'width=device-width, initial-scale=1',
  manifest: '/manifest.json',
  themeColor: '#4F46E5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-gradient-to-br from-blue-50 to-indigo-100">
        {children}
      </body>
    </html>
  )
}
