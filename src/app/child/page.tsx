'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export default function ChildPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [status, setStatus] = useState('시작 중...')
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastFinalRef = useRef('')

  // TTS 함수
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return
    
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1.2
    utterance.volume = 1.0

    const voices = window.speechSynthesis.getVoices()
    const koVoice = voices.find(v => v.lang.includes('ko'))
    if (koVoice) utterance.voice = koVoice

    window.speechSynthesis.speak(utterance)
  }, [])

  // API 호출
  const callAPI = useCallback(async (text: string) => {
    if (isProcessingRef.current || !text.trim()) return
    
    isProcessingRef.current = true
    setIsProcessing(true)
    setStatus('💭 생각 중...')

    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })

      const data = await res.json()

      if (data.ok) {
        setResponse(data.message)
        speak(data.message)
      } else {
        setResponse('다시 말해줄래?')
        speak('다시 말해줄래?')
      }
    } catch (error) {
      console.error('API 오류:', error)
      setResponse('잠깐, 다시 해볼까?')
      speak('잠깐, 다시 해볼까?')
    } finally {
      setIsProcessing(false)
      isProcessingRef.current = false
      setStatus('🎤 듣고 있어요')
      lastFinalRef.current = ''
    }
  }, [speak])

  // 텍스트에서 웨이크 워드 제거
  const removeWakeWord = (text: string): string => {
    const patterns = ['아이야', '아이얌', '아이아', '아이여', '애야', '이야', '아야']
    let result = text
    for (const p of patterns) {
      result = result.replace(new RegExp(p, 'gi'), '').trim()
    }
    return result || text  // 빈 문자열이면 원본 반환
  }

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus('❌ 음성 인식 미지원')
      return
    }

    window.speechSynthesis.getVoices()

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'

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

      // 최종 결과가 있으면 타이머 시작 (말 끝나고 1초 후 API 호출)
      if (finalTranscript && !isProcessingRef.current) {
        lastFinalRef.current = finalTranscript
        
        // 이전 타이머 클리어
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
        
        // 1초 후 API 호출 (더 말할 수 있도록)
        silenceTimerRef.current = setTimeout(() => {
          if (lastFinalRef.current && !isProcessingRef.current) {
            const cleanText = removeWakeWord(lastFinalRef.current)
            console.log('[API 호출]', lastFinalRef.current, '→', cleanText)
            callAPI(cleanText)
          }
        }, 1000)
      }
    }

    recognition.onerror = (event: any) => {
      console.log('[오류]', event.error)
      if (event.error === 'not-allowed') {
        setStatus('🔒 마이크 권한 필요')
        return
      }
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
        }, 300)
      }
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        recognition.start()
        setStatus('🎤 듣고 있어요')
      })
      .catch((err) => {
        console.error('[마이크 권한 거부]', err)
        setStatus('🔒 마이크 권한 필요')
      })

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      try { recognition.stop() } catch (e) {}
    }
  }, [callAPI])

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${isProcessing ? 'animate-pulse' : 'animate-bounce'}`}>
          {isProcessing ? '🤔' : '🎤'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
        <p className="text-xl text-purple-600">뭐든 말해봐!</p>
      </div>

      {lastHeard && (
        <div className="mb-4 px-5 py-2 bg-white/60 rounded-full text-gray-700 text-lg max-w-xs text-center">
          🎧 "{lastHeard}"
        </div>
      )}

      {response && (
        <div className="mt-2 p-6 bg-white rounded-3xl shadow-xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {isProcessing && (
        <div className="mt-6">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-300 border-t-purple-600"></div>
        </div>
      )}

      <div className="fixed bottom-4 left-4 right-4 flex justify-center">
        <div className={`px-5 py-2 rounded-full text-base font-semibold shadow-lg ${
          isProcessing 
            ? 'bg-yellow-400 text-gray-800' 
            : status.includes('듣고') 
              ? 'bg-green-500 text-white'
              : 'bg-red-400 text-white'
        }`}>
          {status}
        </div>
      </div>
    </main>
  )
}
