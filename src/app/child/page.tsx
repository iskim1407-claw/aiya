'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export default function ChildPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [status, setStatus] = useState('시작 중...')
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef(false)

  // TTS 함수
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return
    
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9  // 조금 느리게 (아이용)
    utterance.pitch = 1.2  // 약간 높게 (친근하게)
    utterance.volume = 1.0

    // 음성 로드 후 시작
    const voices = window.speechSynthesis.getVoices()
    const koVoice = voices.find(v => v.lang.includes('ko'))
    if (koVoice) {
      utterance.voice = koVoice
    }

    window.speechSynthesis.speak(utterance)
  }, [])

  // API 호출
  const callAPI = useCallback(async (text: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setIsProcessing(true)
    setStatus('💭 생각 중...')
    setResponse('')

    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await res.json()

      if (data.ok) {
        setResponse(data.message)
        // 🔊 음성으로 응답
        speak(data.message)
      } else {
        const errorMsg = '다시 말해줄래?'
        setResponse(errorMsg)
        speak(errorMsg)
      }
    } catch (error) {
      console.error('API 오류:', error)
      const errorMsg = '잠깐만, 다시 해볼까?'
      setResponse(errorMsg)
      speak(errorMsg)
    } finally {
      setIsProcessing(false)
      isProcessingRef.current = false
      setStatus('🎤 듣고 있어요')
    }
  }, [speak])

  // 웨이크 워드 체크
  const checkWakeWord = useCallback((text: string): string | null => {
    const lower = text.toLowerCase().replace(/\s/g, '')
    const wakePatterns = ['아이야', '아이얌', '아이아', '아이여', '애야', '이야', '아야']
    
    for (const pattern of wakePatterns) {
      if (lower.includes(pattern)) {
        // 웨이크 워드 이후 텍스트
        const idx = lower.indexOf(pattern)
        let afterWake = text.substring(idx + pattern.length).trim()
        
        // 웨이크 워드만 말한 경우 → 기본 인사
        if (!afterWake || afterWake.length < 2) {
          return '안녕'
        }
        return afterWake
      }
    }
    return null
  }, [])

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus('❌ 음성 인식 미지원')
      setResponse('이 브라우저는 음성 인식을 지원하지 않아요')
      return
    }

    // 음성 목록 로드 (TTS용)
    window.speechSynthesis.getVoices()

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'
    recognition.maxAlternatives = 3

    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

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
      }

      // 최종 결과에서 웨이크 워드 체크
      if (finalTranscript && !isProcessingRef.current) {
        const afterWake = checkWakeWord(finalTranscript)
        if (afterWake !== null) {
          console.log('[웨이크 워드 감지]', finalTranscript, '→', afterWake)
          callAPI(afterWake)
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.log('[음성 인식 오류]', event.error)
      if (event.error === 'not-allowed') {
        setStatus('🔒 마이크 권한 필요')
        return
      }
      // 자동 재시작
      setTimeout(() => {
        try { recognition.start() } catch (e) {}
      }, 1000)
    }

    recognition.onend = () => {
      if (!isProcessingRef.current) {
        setTimeout(() => {
          try { 
            recognition.start()
            setStatus('🎤 듣고 있어요')
          } catch (e) {}
        }, 500)
      }
    }

    // 마이크 권한 요청 후 시작
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        recognition.start()
        setStatus('🎤 듣고 있어요')
      })
      .catch((err) => {
        console.error('[마이크 권한 거부]', err)
        setStatus('🔒 마이크 권한을 허용해주세요')
      })

    return () => {
      try { recognition.stop() } catch (e) {}
    }
  }, [callAPI, checkWakeWord])

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      {/* 메인 */}
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${isProcessing ? 'animate-pulse' : 'animate-bounce'}`}>
          {isProcessing ? '🤔' : '🎤'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
        <p className="text-xl text-purple-600 font-medium">
          "아이야~" 라고 불러봐!
        </p>
      </div>

      {/* 들린 내용 */}
      {lastHeard && (
        <div className="mb-4 px-5 py-2 bg-white/60 rounded-full text-gray-700 text-lg">
          🎧 "{lastHeard}"
        </div>
      )}

      {/* 응답 */}
      {response && (
        <div className="mt-2 p-6 bg-white rounded-3xl shadow-xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {/* 로딩 */}
      {isProcessing && (
        <div className="mt-6">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-300 border-t-purple-600"></div>
        </div>
      )}

      {/* 상태 바 */}
      <div className="fixed bottom-4 left-4 right-4 flex justify-center">
        <div className={`px-5 py-2 rounded-full text-base font-semibold shadow-lg ${
          isProcessing 
            ? 'bg-yellow-400 text-gray-800' 
            : status.includes('듣고') 
              ? 'bg-green-500 text-white'
              : 'bg-gray-400 text-white'
        }`}>
          {status}
        </div>
      </div>
    </main>
  )
}
