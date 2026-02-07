'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-indigo-900 mb-4">아이야</h1>
        <p className="text-xl text-gray-600 mb-8">2~4세 유아용 한국어 음성 비서</p>
        
        <div className="flex gap-4 justify-center">
          <Link 
            href="/child" 
            className="px-8 py-4 bg-blue-500 text-white rounded-lg text-lg font-semibold hover:bg-blue-600 transition"
          >
            아이 모드
          </Link>
          <Link 
            href="/parent" 
            className="px-8 py-4 bg-gray-600 text-white rounded-lg text-lg font-semibold hover:bg-gray-700 transition"
          >
            부모 대시보드
          </Link>
        </div>
      </div>
    </main>
  )
}
