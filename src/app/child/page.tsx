'use client'

import { useState } from 'react'
import RecordButton from '@/components/RecordButton'
import { speakText } from '@/components/AudioPlayer'

export default function ChildPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [childMessage, setChildMessage] = useState('')

  const handleAudioReady = async (blob: Blob) => {
    setIsLoading(true)
    setResponse('')
    setChildMessage('')

    const formData = new FormData()
    formData.append('audio', blob)
    formData.append('childId', 'default-child')

    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        setResponse('오류가 발생했어요. 다시 해볼까?')
        return
      }

      const data = await res.json()
      
      if (data.ok) {
        setResponse(data.message)
        
        // 🔊 자동 음성 재생 (Web Speech Synthesis)
        speakText(data.message)
      } else {
        setResponse(data.error || '뭔가 잘못됐어요...')
      }
    } catch (error) {
      console.error('API 오류:', error)
      setResponse('연결할 수 없어요. 잠깐 기다렸다가 다시 해볼까?')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="child-interface flex flex-col items-center justify-center min-h-screen p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-purple-900 mb-2">🎤 아이야!</h1>
        <p className="text-lg text-gray-700">버튼을 누르고 말해보세요!</p>
      </div>

      {/* 녹음 버튼 */}
      <RecordButton onAudioReady={handleAudioReady} isLoading={isLoading} />

      {/* 응답 메시지 */}
      {response && (
        <div className="mt-12 animate-fade-in p-8 bg-white rounded-3xl shadow-2xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-semibold">
            {response}
          </p>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="mt-12 text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-300 border-t-blue-600"></div>
          </div>
          <p className="mt-4 text-lg text-gray-700">생각하는 중...</p>
        </div>
      )}
    </main>
  )
}
