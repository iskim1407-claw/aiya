'use client'

import { useState, useCallback } from 'react'
import { speakText } from '@/components/AudioPlayer'

export default function ChildPage() {
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [status, setStatus] = useState('👆 화면을 터치해봐!')

  // 음성 인식 시작
  const startListening = useCallback(() => {
    if (isListening || isLoading) return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus('❌ 이 브라우저는 음성 인식을 지원하지 않아요')
      return
    }

    setIsListening(true)
    setResponse('')
    setStatus('🎤 듣고 있어요! 말해봐~')

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'ko-KR'
    recognition.maxAlternatives = 1

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('[음성 인식]', transcript)
      
      setIsListening(false)
      setStatus('💭 생각하는 중...')
      setIsLoading(true)

      // API 호출
      try {
        const res = await fetch('/api/talk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript.trim(),
            childId: 'default-child',
          }),
        })

        if (!res.ok) {
          setResponse('오류가 발생했어요. 다시 해볼까?')
          setStatus('👆 화면을 터치해봐!')
          setIsLoading(false)
          return
        }

        const data = await res.json()

        if (data.ok) {
          setResponse(data.message)
          speakText(data.message)
        } else {
          setResponse(data.error || '뭔가 잘못됐어요...')
        }
      } catch (error) {
        console.error('API 오류:', error)
        setResponse('연결할 수 없어요. 다시 해볼까?')
      } finally {
        setIsLoading(false)
        setStatus('👆 화면을 터치해봐!')
      }
    }

    recognition.onerror = (event: any) => {
      console.error('[음성 인식 오류]', event.error)
      setIsListening(false)
      
      if (event.error === 'not-allowed') {
        setStatus('🔒 마이크 권한을 허용해주세요')
      } else if (event.error === 'no-speech') {
        setStatus('🤔 아무 소리도 안 들렸어요. 다시 해볼까?')
        setTimeout(() => setStatus('👆 화면을 터치해봐!'), 2000)
      } else {
        setStatus('⚠️ 오류가 발생했어요. 다시 해볼까?')
        setTimeout(() => setStatus('👆 화면을 터치해봐!'), 2000)
      }
    }

    recognition.onend = () => {
      if (isListening) {
        setIsListening(false)
      }
    }

    recognition.start()
  }, [isListening, isLoading])

  return (
    <main 
      className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200 select-none"
      onClick={startListening}
      onTouchStart={startListening}
    >
      {/* 메인 캐릭터/아이콘 */}
      <div className="text-center mb-8">
        <div className={`text-9xl mb-4 transition-transform duration-300 ${isListening ? 'animate-bounce scale-110' : ''}`}>
          {isListening ? '👂' : isLoading ? '🤔' : '🎤'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className={`text-2xl font-semibold px-6 py-3 rounded-full inline-block ${
          isListening 
            ? 'bg-green-400 text-white animate-pulse' 
            : isLoading 
              ? 'bg-yellow-400 text-gray-800'
              : 'bg-purple-500 text-white'
        }`}>
          {status}
        </p>
      </div>

      {/* 응답 메시지 */}
      {response && !isLoading && (
        <div className="mt-8 p-8 bg-white rounded-3xl shadow-2xl max-w-md text-center animate-fade-in">
          <p className="text-3xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {/* 로딩 애니메이션 */}
      {isLoading && (
        <div className="mt-8 text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-300 border-t-purple-600"></div>
          </div>
        </div>
      )}

      {/* 하단 안내 */}
      {!isListening && !isLoading && !response && (
        <div className="mt-12 text-center animate-pulse">
          <p className="text-xl text-purple-600 font-medium">
            👆 화면 아무 곳이나 터치하면<br/>
            아이야가 들어줄 거야!
          </p>
        </div>
      )}
    </main>
  )
}
