'use client'

import { useState, useEffect } from 'react'
import WakeWordDetector from '@/components/WakeWordDetector'
import { speakText } from '@/components/AudioPlayer'

export default function ChildPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [isListening, setIsListening] = useState(true)

  // 웨이크 워드 감지 후 음성 텍스트 처리
  const handleWakeWord = async (text: string) => {
    if (!text.trim()) return

    setIsLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          childId: 'default-child',
        }),
      })

      if (!res.ok) {
        setResponse('오류가 발생했어요. 다시 말해볼까?')
        return
      }

      const data = await res.json()

      if (data.ok) {
        setResponse(data.message)
        // 🔊 자동 음성 재생
        speakText(data.message)
      } else {
        setResponse(data.error || '뭔가 잘못됐어요...')
      }
    } catch (error) {
      console.error('API 오류:', error)
      setResponse('연결할 수 없어요. 다시 해볼까?')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="child-interface flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-100 to-purple-100">
      <WakeWordDetector onWakeWord={handleWakeWord} isListening={isListening} />

      <div className="text-center mb-8">
        <h1 className="text-6xl font-bold text-purple-900 mb-3">🎤 아이야!</h1>
        <p className="text-xl text-purple-700 font-semibold">
          "아이야~" 라고 말해봐! 🗣️
        </p>
      </div>

      {/* 응답 메시지 */}
      {response && (
        <div className="mt-8 animate-fade-in p-8 bg-white rounded-3xl shadow-2xl max-w-md text-center">
          <p className="text-3xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="mt-8 text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-300 border-t-purple-600"></div>
          </div>
          <p className="mt-4 text-xl text-gray-700 font-semibold">생각하는 중... 💭</p>
        </div>
      )}

      {/* 상태 표시 */}
      {!isLoading && !response && (
        <div className="mt-12 text-center">
          <div className="text-6xl mb-4">👂</div>
          <p className="text-lg text-gray-700">
            "아이야~" 라고 불러봐요!
          </p>
        </div>
      )}
    </main>
  )
}
