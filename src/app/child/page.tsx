'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { speakText } from '@/components/AudioPlayer'

export default function ChildPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef(false)

  // API 호출
  const callAPI = useCallback(async (text: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setIsProcessing(true)
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

      const data = await res.json()

      if (data.ok) {
        setResponse(data.message)
        speakText(data.message)
      } else {
        setResponse('다시 말해볼까?')
      }
    } catch (error) {
      console.error('API 오류:', error)
      setResponse('연결 오류! 다시 해볼까?')
    } finally {
      setIsProcessing(false)
      isProcessingRef.current = false
    }
  }, [])

  // 웨이크 워드 체크
  const checkWakeWord = useCallback((text: string): string | null => {
    const lower = text.toLowerCase().replace(/\s/g, '')
    const wakePatterns = [
      '아이야', '아이얌', '아이아', '아이여', '애야', 
      '이야', '아야', 'aiya', 'aiya'
    ]
    
    for (const pattern of wakePatterns) {
      const idx = lower.indexOf(pattern)
      if (idx !== -1) {
        // 웨이크 워드 이후 텍스트 반환
        const afterWake = text.substring(idx + pattern.length).trim()
        return afterWake || '안녕'  // 빈 문자열이면 기본 인사
      }
    }
    return null
  }, [])

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setResponse('이 브라우저는 음성 인식을 지원하지 않아요 😢')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'
    recognition.maxAlternatives = 3

    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const currentText = finalTranscript || interimTranscript
      if (currentText) {
        setLastHeard(currentText)
        console.log('[들림]', currentText)
      }

      // 최종 결과에서 웨이크 워드 체크
      if (finalTranscript && !isProcessingRef.current) {
        const afterWake = checkWakeWord(finalTranscript)
        if (afterWake !== null) {
          console.log('[웨이크 워드 감지!]', finalTranscript, '→', afterWake)
          callAPI(afterWake)
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.log('[음성 인식 오류]', event.error)
      // 자동 재시작
      if (event.error !== 'not-allowed') {
        setTimeout(() => {
          try { recognition.start() } catch (e) {}
        }, 1000)
      }
    }

    recognition.onend = () => {
      console.log('[음성 인식 종료, 재시작]')
      if (!isProcessingRef.current) {
        setTimeout(() => {
          try { recognition.start() } catch (e) {}
        }, 500)
      }
    }

    // 마이크 권한 요청 후 시작
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        recognition.start()
        console.log('[음성 인식 시작]')
      })
      .catch((err) => {
        console.error('[마이크 권한 거부]', err)
        setResponse('🔒 마이크 권한을 허용해주세요')
      })

    return () => {
      try { recognition.stop() } catch (e) {}
    }
  }, [callAPI, checkWakeWord])

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      {/* 메인 */}
      <div className="text-center mb-8">
        <div className={`text-9xl mb-4 transition-all duration-300 ${isProcessing ? 'animate-pulse' : 'animate-bounce'}`}>
          {isProcessing ? '🤔' : '🎤'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className="text-2xl text-purple-600 font-semibold">
          {isProcessing ? '💭 생각하는 중...' : '"아이야~" 라고 불러봐!'}
        </p>
      </div>

      {/* 들린 내용 표시 (디버그용) */}
      {lastHeard && !isProcessing && (
        <div className="mb-4 px-6 py-2 bg-gray-100 rounded-full text-gray-600 text-lg">
          🎧 "{lastHeard}"
        </div>
      )}

      {/* 응답 */}
      {response && !isProcessing && (
        <div className="mt-4 p-8 bg-white rounded-3xl shadow-2xl max-w-md text-center">
          <p className="text-3xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {/* 로딩 */}
      {isProcessing && (
        <div className="mt-8">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-300 border-t-purple-600"></div>
        </div>
      )}

      {/* 상태 표시 */}
      <div className="fixed bottom-4 left-4 right-4 flex justify-center">
        <div className={`px-6 py-3 rounded-full text-lg font-semibold shadow-lg ${
          isProcessing 
            ? 'bg-yellow-400 text-gray-800' 
            : 'bg-green-500 text-white'
        }`}>
          {isProcessing ? '💭 생각 중...' : '🎤 듣고 있어요'}
        </div>
      </div>
    </main>
  )
}
