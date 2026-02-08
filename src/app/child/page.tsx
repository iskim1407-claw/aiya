'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type State = 'init' | 'recording' | 'processing' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('init')
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [history, setHistory] = useState<{role: string, content: string}[]>([])
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const stateRef = useRef<State>('init')
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoRestartRef = useRef(true)

  const updateState = useCallback((newState: State) => {
    setState(newState)
    stateRef.current = newState
  }, [])

  // TTS (5초 타임아웃으로 stuck 방지)
  const speak = useCallback((text: string, audioData?: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') { onEnd?.(); return }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    window.speechSynthesis?.cancel()
    
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onEnd?.()
    }
    
    // 5초 후 강제 진행 (stuck 방지)
    const timeout = setTimeout(() => {
      console.log('[TTS 타임아웃 - 강제 진행]')
      finish()
    }, 5000)
    
    const done = () => {
      clearTimeout(timeout)
      finish()
    }
    
    console.log('[TTS]', text, audioData ? '(OpenAI)' : '(브라우저)')
    
    if (audioData) {
      const audio = new Audio(audioData)
      audioRef.current = audio
      audio.onended = () => { console.log('[Audio 완료]'); done() }
      audio.onerror = (e) => { console.log('[Audio 에러]', e); done() }
      audio.play()
        .then(() => console.log('[Audio 재생 시작]'))
        .catch((e) => { console.log('[Audio 재생 실패]', e); done() })
      return
    }
    
    // 브라우저 TTS fallback
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1.2
    utterance.onend = () => done()
    utterance.onerror = () => done()
    window.speechSynthesis.speak(utterance)
  }, [])

  // 작별 인사 체크
  const isGoodbye = (text: string): boolean => {
    const goodbyes = ['잘가', '잘 가', '바이', '바이바이', '끝', '그만', '다음에', '나중에', '안녕']
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
        console.log('[인식 안됨]')
        if (autoRestartRef.current) {
          updateState('recording')
          startRecording()
        }
        return
      }

      const { transcript, message, audio } = data
      setLastHeard(transcript)
      console.log('[인식됨]', transcript)
      
      // 히스토리 업데이트
      setHistory(prev => [...prev, { role: 'user', content: transcript }, { role: 'assistant', content: message }].slice(-10))
      
      // 작별 체크
      if (isGoodbye(transcript)) {
        setResponse('응! 또 놀자! 👋')
        autoRestartRef.current = false
        speak('응! 또 놀자! 안녕!', audio, () => {
          updateState('init')
          setResponse('')
          setLastHeard('')
          setHistory([])
        })
        return
      }
      
      setResponse(message)
      updateState('speaking')
      
      speak(message, audio, () => {
        if (autoRestartRef.current) {
          updateState('recording')
          startRecording()
        }
      })
      
    } catch (error) {
      console.error('[처리 오류]', error)
      if (autoRestartRef.current) {
        updateState('recording')
        startRecording()
      }
    }
  }, [history, speak])

  // 녹음 시작
  const startRecording = useCallback(async () => {
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
      console.log('[녹음 시작]')
      
      // 3초 녹음
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
          console.log('[녹음 완료]')
        }
      }, 3000)
      
    } catch (error) {
      console.error('[녹음 오류]', error)
    }
  }, [processAudio])

  // 시작 버튼
  const handleStart = useCallback(async () => {
    console.log('[시작 버튼 클릭]')
    setResponse('시작 중...')
    
    try {
      // 오디오 unlock
      const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+9DEAAAIAANIAAAAgAAA0gAAABBMTEhJSWBgYGBgVFRVRcXFxMTExcXFhYWFkZGRpaWloKChsbGxqamprq6utra2u7u7wcHBxsbGy8vL0dHR1tbW3Nzc4eHh5ubm7Ozs8fHx9vb2+/v7//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxAADwAADSAAAAAIAA0gAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      try { await silentAudio.play() } catch (e) { console.log('[Audio unlock 실패]', e) }
      
      window.speechSynthesis?.cancel()
      
      // 마이크 권한 요청
      console.log('[마이크 권한 요청]')
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[마이크 권한 성공]')
      
      autoRestartRef.current = true
      setResponse('')
      
      // 인사하고 녹음 시작
      speak('응! 뭐야?', undefined, () => {
        startRecording()
      })
    } catch (e: any) {
      console.error('[시작 에러]', e)
      setResponse('마이크 권한이 필요해요! 🎤')
    }
  }, [speak, startRecording])

  // 정지 버튼
  const handleStop = useCallback(() => {
    autoRestartRef.current = false
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
    updateState('init')
    setResponse('')
    setLastHeard('')
    setHistory([])
    speak('또 불러줘!')
  }, [speak])

  // 정리
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  // 시작 화면
  if (state === 'init') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
        <div className="text-9xl mb-8 animate-bounce">🤗</div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className="text-xl text-purple-600 mb-8">AI 친구와 대화해요</p>
        <button
          onClick={handleStart}
          className="px-12 py-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-3xl font-bold rounded-full shadow-2xl active:scale-95 transition-transform"
        >
          🎤 대화하기
        </button>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      <div className="text-center mb-6">
        <div className={`text-8xl mb-4 ${state === 'recording' ? 'animate-bounce' : state === 'processing' ? 'animate-pulse' : ''}`}>
          {state === 'recording' ? '👂' : state === 'processing' ? '🤔' : '🗣️'}
        </div>
        <h1 className="text-5xl font-bold text-purple-800 mb-3">아이야!</h1>
        <p className="text-lg text-purple-600">
          {state === 'recording' ? '듣고 있어요...' : state === 'processing' ? '생각 중...' : '말하는 중...'}
        </p>
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

      <button
        onClick={handleStop}
        className="fixed bottom-8 px-8 py-4 bg-red-400 text-white text-xl font-bold rounded-full shadow-lg active:scale-95 transition-transform"
      >
        👋 끝내기
      </button>
    </main>
  )
}
