'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type State = 'init' | 'waiting' | 'recording' | 'processing' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('init')
  const [sessionActive, setSessionActive] = useState(false)
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [history, setHistory] = useState<{role: string, content: string}[]>([])
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const stateRef = useRef<State>('init')
  const sessionActiveRef = useRef(false)
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)

  const SESSION_TIMEOUT = 30000

  const updateState = useCallback((newState: State) => {
    setState(newState)
    stateRef.current = newState
  }, [])

  // 오디오 unlock (브라우저 autoplay 정책)
  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) return
    
    // 무음 오디오 재생으로 unlock
    const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+9DEAAAIAANIAAAAgAAA0gAAABBMTEhJSWBgYGBgVFRVRcXFxMTExcXFhYWFkZGRpaWloKChsbGxqamprq6utra2u7u7wcHBxsbGy8vL0dHR1tbW3Nzc4eHh5ubm7Ozs8fHx9vb2+/v7//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxAADwAADSAAAAAIAA0gAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    try {
      await silentAudio.play()
      audioUnlockedRef.current = true
      setAudioUnlocked(true)
      console.log('[Audio Unlocked]')
    } catch (e) {
      console.log('[Audio Unlock Failed]', e)
    }

    // Speech Synthesis도 unlock
    const utterance = new SpeechSynthesisUtterance('')
    window.speechSynthesis.speak(utterance)
  }, [])

  const updateSession = useCallback((active: boolean) => {
    setSessionActive(active)
    sessionActiveRef.current = active
  }, [])

  // 세션 타이머
  const resetSessionTimer = useCallback(() => {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    
    if (sessionActiveRef.current) {
      setCountdown(30)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => prev <= 1 ? 0 : prev - 1)
      }, 1000)
      sessionTimeoutRef.current = setTimeout(() => endSession(), SESSION_TIMEOUT)
    }
  }, [])

  // TTS
  const speak = useCallback((text: string, audioData?: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') { onEnd?.(); return }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    window.speechSynthesis.cancel()
    
    console.log('[TTS 시작]', text, audioData ? '(OpenAI)' : '(브라우저)')
    
    if (audioData) {
      const audio = new Audio(audioData)
      audioRef.current = audio
      audio.onended = () => { console.log('[Audio 완료]'); onEnd?.() }
      audio.onerror = (e) => { console.log('[Audio 에러]', e); speakFallback(text, onEnd) }
      audio.play()
        .then(() => console.log('[Audio 재생 시작]'))
        .catch((e) => { console.log('[Audio 재생 실패]', e); speakFallback(text, onEnd) })
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
      setLastHeard('')
      startWakeWordListening()
    })
  }, [speak])

  // 작별 인사 체크
  const isGoodbye = (text: string): boolean => {
    const goodbyes = ['잘가', '잘 가', '바이', '바이바이', '끝', '그만', '다음에', '나중에']
    return goodbyes.some(g => text.includes(g))
  }

  // Whisper로 오디오 처리
  const processAudio = useCallback(async (audioBlob: Blob) => {
    updateState('processing')
    
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      formData.append('history', JSON.stringify(history))
      
      const res = await fetch('/api/talk-whisper', { method: 'POST', body: formData })
      const data = await res.json()
      
      if (!data.ok || !data.transcript) {
        if (sessionActiveRef.current) {
          updateState('recording')
          startSessionRecording()
        } else {
          updateState('waiting')
          startWakeWordListening()
        }
        return
      }

      const { transcript, message, audio } = data
      setLastHeard(transcript)
      
      // 작별 체크
      if (sessionActiveRef.current && isGoodbye(transcript)) {
        setResponse('응! 또 놀자! 안녕~')
        speak('응! 또 놀자! 안녕~', undefined, () => endSession())
        return
      }
      
      // 히스토리 업데이트
      setHistory(prev => [...prev, { role: 'user', content: transcript }, { role: 'assistant', content: message }].slice(-10))
      
      setResponse(message)
      updateState('speaking')
      
      speak(message, audio, () => {
        resetSessionTimer()
        updateState('recording')
        startSessionRecording()
      })
      
    } catch (error) {
      console.error('처리 오류:', error)
      if (sessionActiveRef.current) {
        updateState('recording')
        startSessionRecording()
      } else {
        updateState('waiting')
        startWakeWordListening()
      }
    }
  }, [history, speak, resetSessionTimer, endSession])

  // 세션 중 녹음 (Whisper용)
  const startSessionRecording = useCallback(async () => {
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      
      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          processAudio(audioBlob)
        }
      }
      
      mediaRecorder.start()
      updateState('recording')
      
      // 4초 녹음
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, 4000)
      
    } catch (error) {
      console.error('녹음 오류:', error)
    }
  }, [processAudio])

  // 웨이크 워드 감지 (Web Speech API)
  const startWakeWordListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (recognitionRef.current) try { recognitionRef.current.stop() } catch (e) {}

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'
    recognitionRef.current = recognition

    const wakeWords = ['아이야', '아이얌', '아이아', '아이여', '애야', '이야', '아야', '아이']

    recognition.onresult = (event: any) => {
      if (stateRef.current !== 'waiting') return

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        setLastHeard(transcript)
        
        const lower = transcript.toLowerCase().replace(/\s/g, '')
        if (wakeWords.some(w => lower.includes(w))) {
          console.log('[웨이크 워드!]', transcript)
          recognition.stop()
          
          updateSession(true)
          updateState('speaking')
          setLastHeard('')
          
          speak('응! 뭐야?', undefined, () => {
            resetSessionTimer()
            updateState('recording')
            startSessionRecording()
          })
          return
        }
      }
    }

    recognition.onend = () => {
      if (stateRef.current === 'waiting' && !sessionActiveRef.current) {
        setTimeout(() => { try { recognition.start() } catch (e) {} }, 300)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'not-allowed' && stateRef.current === 'waiting') {
        setTimeout(() => { try { recognition.start() } catch (e) {} }, 1000)
      }
    }

    try { recognition.start() } catch (e) {}
  }, [speak, resetSessionTimer, startSessionRecording])

  // 시작 버튼 핸들러
  const handleStart = useCallback(async () => {
    await unlockAudio()
    
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      window.speechSynthesis?.getVoices()
      updateState('waiting')
      startWakeWordListening()
    } catch (e) {
      console.error('[마이크 권한 실패]', e)
    }
  }, [unlockAudio, startWakeWordListening])

  // 초기화
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const statusText: Record<State, string> = {
    init: '시작하기를 눌러주세요',
    waiting: '💤 "아이야~" 라고 불러봐!',
    recording: '🎤 듣고 있어요...',
    processing: '💭 생각 중...',
    speaking: '🔊 말하는 중...',
  }

  const statusColor: Record<State, string> = {
    init: 'bg-gray-400',
    waiting: 'bg-purple-500',
    recording: 'bg-green-500 animate-pulse',
    processing: 'bg-yellow-400 text-gray-800',
    speaking: 'bg-blue-500',
  }

  // 시작 화면
  if (state === 'init') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
        <div className="text-9xl mb-8 animate-bounce">👋</div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className="text-xl text-purple-600 mb-8">AI 친구와 대화해요</p>
        <button
          onClick={handleStart}
          className="px-12 py-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-3xl font-bold rounded-full shadow-2xl active:scale-95 transition-transform"
        >
          🎤 시작하기
        </button>
        <p className="mt-6 text-gray-500 text-sm">버튼을 누르면 마이크와 스피커가 켜져요</p>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${state === 'recording' ? 'animate-bounce' : state === 'processing' ? 'animate-pulse' : ''}`}>
          {state === 'waiting' ? '😴' : state === 'recording' ? '👂' : state === 'processing' ? '🤔' : '🗣️'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
        {sessionActive && (
          <p className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full inline-block">
            대화 중 {countdown > 0 && `(${countdown}초)`}
          </p>
        )}
      </div>

      {lastHeard && (
        <div className="mb-4 px-5 py-2 bg-white/60 rounded-full text-gray-700 text-lg">
          🎧 "{lastHeard}"
        </div>
      )}

      {response && (
        <div className="mt-2 p-6 bg-white rounded-3xl shadow-xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-bold">{response}</p>
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
