'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type State = 'waiting' | 'recording' | 'processing' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('waiting')
  const [sessionActive, setSessionActive] = useState(false)
  const [response, setResponse] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [history, setHistory] = useState<{role: string, content: string}[]>([])
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const stateRef = useRef<State>('waiting')
  const sessionActiveRef = useRef(false)
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const SESSION_TIMEOUT = 30000

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
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    
    if (sessionActiveRef.current) {
      setCountdown(30)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => prev <= 1 ? 0 : prev - 1)
      }, 1000)
      
      sessionTimeoutRef.current = setTimeout(() => {
        endSession()
      }, SESSION_TIMEOUT)
    }
  }, [])

  // 세션 종료
  const endSession = useCallback(() => {
    updateSession(false)
    setCountdown(0)
    setHistory([])
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    
    speak('또 불러줘!', undefined, () => {
      updateState('waiting')
      setResponse('')
    })
  }, [])

  // TTS
  const speak = useCallback((text: string, audioData?: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') { onEnd?.(); return }
    
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    window.speechSynthesis.cancel()
    
    if (audioData) {
      const audio = new Audio(audioData)
      audioRef.current = audio
      audio.onended = () => onEnd?.()
      audio.onerror = () => speakFallback(text, onEnd)
      audio.play().catch(() => speakFallback(text, onEnd))
      return
    }
    speakFallback(text, onEnd)
  }, [])

  const speakFallback = (text: string, onEnd?: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1.2
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.speak(utterance)
  }

  // 작별 인사 체크
  const isGoodbye = (text: string): boolean => {
    const goodbyes = ['잘가', '잘 가', '바이', '바이바이', '끝', '그만', '다음에', '나중에', '끊어', '꺼']
    return goodbyes.some(g => text.includes(g))
  }

  // API 호출 (Whisper STT + GPT + TTS)
  const processAudio = useCallback(async (audioBlob: Blob) => {
    updateState('processing')
    
    try {
      // 1. Whisper STT
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      formData.append('history', JSON.stringify(history))
      
      const res = await fetch('/api/talk-whisper', {
        method: 'POST',
        body: formData,
      })
      
      const data = await res.json()
      
      if (!data.ok) {
        setResponse('다시 말해줄래?')
        speak('다시 말해줄래?', undefined, () => {
          updateState('recording')
          resetSessionTimer()
          startRecording()
        })
        return
      }

      const { transcript, message, audio } = data
      
      // 웨이크 워드 체크 (세션 시작)
      if (!sessionActiveRef.current) {
        const wakeWords = ['아이야', '아이얌', '아이아', '아이여', '애야', '이야', '아야', '아이']
        const hasWakeWord = wakeWords.some(w => transcript.toLowerCase().includes(w))
        
        if (!hasWakeWord) {
          updateState('waiting')
          return
        }
        
        // 세션 시작
        updateSession(true)
      }
      
      // 작별 인사 체크
      if (isGoodbye(transcript)) {
        setResponse('응! 또 놀자! 안녕~')
        speak('응! 또 놀자! 안녕~', undefined, () => endSession())
        return
      }
      
      // 대화 히스토리 업데이트
      setHistory(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: message }
      ].slice(-10))
      
      setResponse(message)
      updateState('speaking')
      
      speak(message, audio, () => {
        updateState('recording')
        resetSessionTimer()
        startRecording()
      })
      
    } catch (error) {
      console.error('처리 오류:', error)
      setResponse('잠깐, 다시 해볼까?')
      speak('잠깐, 다시 해볼까?', undefined, () => {
        if (sessionActiveRef.current) {
          updateState('recording')
          startRecording()
        } else {
          updateState('waiting')
        }
      })
    }
  }, [history, speak, resetSessionTimer, endSession, updateSession, updateState])

  // 녹음 시작
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          processAudio(audioBlob)
        }
      }
      
      mediaRecorder.start()
      updateState('recording')
      
      // 3초 후 자동 중지 (짧은 발화용)
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, 3000)
      
    } catch (error) {
      console.error('마이크 오류:', error)
      updateState('waiting')
    }
  }, [processAudio, updateState])

  // 녹음 중지
  const stopRecording = useCallback(() => {
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // 화면 터치로 녹음 시작/중지
  const handleTap = useCallback(() => {
    if (stateRef.current === 'waiting' || stateRef.current === 'recording') {
      if (stateRef.current === 'recording') {
        stopRecording()
      } else {
        startRecording()
      }
    }
  }, [startRecording, stopRecording])

  // 초기화
  useEffect(() => {
    window.speechSynthesis?.getVoices()
    return () => {
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
    }
  }, [])

  const statusText = {
    waiting: '👆 터치해서 말해봐!',
    recording: '🎤 듣고 있어요...',
    processing: '💭 생각 중...',
    speaking: '🔊 말하는 중...',
  }

  const statusColor = {
    waiting: 'bg-purple-500',
    recording: 'bg-red-500 animate-pulse',
    processing: 'bg-yellow-400 text-gray-800',
    speaking: 'bg-blue-500',
  }

  const emoji = {
    waiting: '😴',
    recording: '👂',
    processing: '🤔',
    speaking: '🗣️',
  }

  return (
    <main 
      className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200 select-none"
      onClick={handleTap}
    >
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${state === 'recording' ? 'animate-bounce' : state === 'processing' ? 'animate-pulse' : ''}`}>
          {emoji[state]}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
        {sessionActive && (
          <p className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full inline-block">
            대화 중 {countdown > 0 && `(${countdown}초)`}
          </p>
        )}
      </div>

      {response && (
        <div className="mt-2 p-6 bg-white rounded-3xl shadow-xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-bold">
            {response}
          </p>
        </div>
      )}

      {state === 'processing' && (
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
