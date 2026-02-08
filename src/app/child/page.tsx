'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type State = 'waiting' | 'listening' | 'thinking' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('waiting')
  const [sessionActive, setSessionActive] = useState(false)
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [countdown, setCountdown] = useState(0)
  
  const recognitionRef = useRef<any>(null)
  const stateRef = useRef<State>('waiting')
  const sessionActiveRef = useRef(false)
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const SESSION_TIMEOUT = 30000 // 30초

  const updateState = useCallback((newState: State) => {
    setState(newState)
    stateRef.current = newState
  }, [])

  const updateSession = useCallback((active: boolean) => {
    setSessionActive(active)
    sessionActiveRef.current = active
  }, [])

  // 세션 타이머 리셋
  const resetSessionTimer = useCallback(() => {
    // 기존 타이머 클리어
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    
    if (sessionActiveRef.current) {
      setCountdown(30)
      
      // 카운트다운
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      // 30초 후 세션 종료
      sessionTimeoutRef.current = setTimeout(() => {
        console.log('[세션 타임아웃]')
        endSession()
      }, SESSION_TIMEOUT)
    }
  }, [])

  // 세션 종료
  const endSession = useCallback(() => {
    console.log('[세션 종료]')
    updateSession(false)
    setCountdown(0)
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    
    // 작별 인사
    speak('또 불러줘!', () => {
      updateState('waiting')
      setResponse('')
      setLastHeard('')
      startWakeWordListening()
    })
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
        // 세션 유지 - 다시 듣기 상태로
        updateState('listening')
        resetSessionTimer()
        startSessionListening()
      })
    } catch (error) {
      console.error('API 오류:', error)
      setResponse('잠깐, 다시 해볼까?')
      updateState('listening')
      resetSessionTimer()
      startSessionListening()
    }
  }, [speak, resetSessionTimer])

  // 세션 중 듣기 (웨이크 워드 없이)
  const startSessionListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'
    recognitionRef.current = recognition

    let finalText = ''
    let silenceTimer: NodeJS.Timeout | null = null

    recognition.onresult = (event: any) => {
      if (stateRef.current !== 'listening') return
      
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }
      
      setLastHeard(finalText || interim)
      
      // 세션 타이머 리셋 (말하는 중)
      resetSessionTimer()
      
      if (finalText) {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (finalText.trim() && stateRef.current === 'listening') {
            recognition.stop()
            callAPI(finalText.trim())
            finalText = ''
          }
        }, 1500)
      }
    }

    recognition.onend = () => {
      // 세션 활성화 중이고 듣기 상태면 재시작
      if (sessionActiveRef.current && stateRef.current === 'listening') {
        setTimeout(() => {
          try { recognition.start() } catch (e) {}
        }, 300)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'not-allowed' && sessionActiveRef.current) {
        setTimeout(() => {
          try { recognition.start() } catch (e) {}
        }, 1000)
      }
    }

    try { recognition.start() } catch (e) {}
  }, [callAPI, resetSessionTimer])

  // 웨이크 워드 감지 (세션 비활성화 시)
  const startWakeWordListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
    }

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
          
          // 세션 시작
          updateSession(true)
          updateState('speaking')
          
          speak('응! 뭐야?', () => {
            updateState('listening')
            setLastHeard('')
            resetSessionTimer()
            startSessionListening()
          })
          return
        }
      }
    }

    recognition.onend = () => {
      if (stateRef.current === 'waiting' && !sessionActiveRef.current) {
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
  }, [speak, resetSessionTimer, startSessionListening, updateSession, updateState])

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
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [startWakeWordListening, updateState])

  const statusText = {
    waiting: '💤 "아이야~" 라고 불러봐!',
    listening: `🎤 듣고 있어요! ${countdown > 0 ? `(${countdown}초)` : ''}`,
    thinking: '💭 생각 중...',
    speaking: '🔊 말하는 중...',
  }

  const statusColor = {
    waiting: 'bg-purple-500',
    listening: 'bg-green-500',
    thinking: 'bg-yellow-400 text-gray-800',
    speaking: 'bg-blue-500',
  }

  const emoji = {
    waiting: '😴',
    listening: '👂',
    thinking: '🤔',
    speaking: '🗣️',
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${state === 'listening' ? 'animate-bounce' : state === 'thinking' ? 'animate-pulse' : ''}`}>
          {emoji[state]}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
        {sessionActive && (
          <p className="text-sm text-purple-600 bg-purple-100 px-3 py-1 rounded-full inline-block">
            세션 활성화 중
          </p>
        )}
      </div>

      {lastHeard && state === 'listening' && (
        <div className="mb-4 px-5 py-2 bg-white/60 rounded-full text-gray-700 text-lg">
          🎧 "{lastHeard}"
        </div>
      )}

      {response && (state === 'speaking' || state === 'listening') && (
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
