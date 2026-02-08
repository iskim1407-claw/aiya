'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type State = 'waiting' | 'listening' | 'thinking' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('waiting')
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const recognitionRef = useRef<any>(null)
  const listeningRecognitionRef = useRef<any>(null)
  const stateRef = useRef<State>('waiting')

  // 상태 업데이트
  const updateState = useCallback((newState: State) => {
    setState(newState)
    stateRef.current = newState
  }, [])

  // TTS
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1.2
    
    const voices = window.speechSynthesis.getVoices()
    const koVoice = voices.find(v => v.lang.includes('ko'))
    if (koVoice) utterance.voice = koVoice

    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    
    window.speechSynthesis.speak(utterance)
  }, [])

  // API 호출
  const callAPI = useCallback(async (text: string) => {
    updateState('thinking')
    
    try {
      const res = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      const message = data.ok ? data.message : '다시 말해줄래?'
      
      setResponse(message)
      updateState('speaking')
      
      speak(message, () => {
        // TTS 끝나면 다시 대기 상태
        updateState('waiting')
        setLastHeard('')
        startWakeWordListening()
      })
    } catch (error) {
      console.error('API 오류:', error)
      setResponse('잠깐, 다시 해볼까?')
      updateState('waiting')
      startWakeWordListening()
    }
  }, [speak, updateState])

  // 실제 질문 듣기 (웨이크 워드 후)
  const startRealListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    // 웨이크 워드 인식 중지
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
    }

    updateState('listening')
    setLastHeard('')
    setResponse('')

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'ko-KR'
    listeningRecognitionRef.current = recognition

    let finalText = ''
    let silenceTimer: NodeJS.Timeout | null = null

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }
      setLastHeard(finalText || interim)
      
      // 말 끝나면 1.5초 후 API 호출
      if (finalText) {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          recognition.stop()
        }, 1500)
      }
    }

    recognition.onend = () => {
      if (finalText.trim()) {
        callAPI(finalText.trim())
      } else {
        // 아무것도 안 들리면 다시 대기
        updateState('waiting')
        startWakeWordListening()
      }
    }

    recognition.onerror = (event: any) => {
      console.log('[듣기 오류]', event.error)
      updateState('waiting')
      startWakeWordListening()
    }

    recognition.start()
  }, [callAPI, updateState])

  // 웨이크 워드 감지
  const startWakeWordListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'
    recognitionRef.current = recognition

    const wakeWords = ['아이야', '아이얌', '아이아', '아이여', '애야']

    recognition.onresult = (event: any) => {
      if (stateRef.current !== 'waiting') return

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase()
        
        if (wakeWords.some(w => transcript.includes(w))) {
          console.log('[웨이크 워드 감지!]', transcript)
          recognition.stop()
          
          // 확인 소리
          speak('응?', () => {
            startRealListening()
          })
          return
        }
      }
    }

    recognition.onend = () => {
      // 대기 상태면 재시작
      if (stateRef.current === 'waiting') {
        setTimeout(() => {
          try { recognition.start() } catch (e) {}
        }, 300)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'not-allowed' && stateRef.current === 'waiting') {
        setTimeout(() => {
          try { recognition.start() } catch (e) {}
        }, 1000)
      }
    }

    try { recognition.start() } catch (e) {}
  }, [speak, startRealListening])

  // 초기화
  useEffect(() => {
    window.speechSynthesis.getVoices()
    
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        updateState('waiting')
        startWakeWordListening()
      })
      .catch((err) => {
        console.error('[마이크 권한 거부]', err)
      })

    return () => {
      if (recognitionRef.current) try { recognitionRef.current.stop() } catch (e) {}
      if (listeningRecognitionRef.current) try { listeningRecognitionRef.current.stop() } catch (e) {}
    }
  }, [startWakeWordListening, updateState])

  const statusText = {
    waiting: '💤 "아이야~" 라고 불러봐!',
    listening: '🎤 듣고 있어요!',
    thinking: '💭 생각 중...',
    speaking: '🔊 말하는 중...',
  }

  const statusColor = {
    waiting: 'bg-purple-500',
    listening: 'bg-green-500',
    thinking: 'bg-yellow-400 text-gray-800',
    speaking: 'bg-blue-500',
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${state === 'listening' ? 'animate-bounce' : state === 'thinking' ? 'animate-pulse' : ''}`}>
          {state === 'waiting' ? '😴' : state === 'listening' ? '👂' : state === 'thinking' ? '🤔' : '🗣️'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
      </div>

      {lastHeard && state === 'listening' && (
        <div className="mb-4 px-5 py-2 bg-white/60 rounded-full text-gray-700 text-lg">
          🎧 "{lastHeard}"
        </div>
      )}

      {response && (state === 'speaking' || state === 'waiting') && (
        <div className="mt-2 p-6 bg-white rounded-3xl shadow-xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {state === 'thinking' && (
        <div className="mt-6">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-300 border-t-purple-600"></div>
        </div>
      )}

      <div className="fixed bottom-4 left-4 right-4 flex justify-center">
        <div className={`px-5 py-3 rounded-full text-lg font-semibold shadow-lg text-white ${statusColor[state]}`}>
          {statusText[state]}
        </div>
      </div>
    </main>
  )
}
