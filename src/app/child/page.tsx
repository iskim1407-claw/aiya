'use client'

import { useState, useEffect, useRef } from 'react'

type State = 'init' | 'recording' | 'processing' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('init')
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [debugMsg, setDebugMsg] = useState('')
  
  const streamRef = useRef<MediaStream | null>(null)
  const historyRef = useRef<{role: string, content: string}[]>([])
  const autoRestartRef = useRef(true)

  // TTS 재생
  async function speak(text: string, audioData?: string): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000) // 5초 타임아웃
      
      if (audioData) {
        const audio = new Audio(audioData)
        audio.onended = () => { clearTimeout(timeout); resolve() }
        audio.onerror = () => { clearTimeout(timeout); resolve() }
        audio.play().catch(() => { clearTimeout(timeout); resolve() })
      } else {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'ko-KR'
        utterance.rate = 0.9
        utterance.onend = () => { clearTimeout(timeout); resolve() }
        utterance.onerror = () => { clearTimeout(timeout); resolve() }
        window.speechSynthesis.speak(utterance)
      }
    })
  }

  // 녹음 & 처리
  async function recordAndProcess() {
    if (!streamRef.current || !autoRestartRef.current) return
    
    setState('recording')
    setDebugMsg('녹음 중...')
    
    try {
      // 녹음
      const mediaRecorder = new MediaRecorder(streamRef.current)
      const chunks: Blob[] = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      
      const audioBlob = await new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
        mediaRecorder.start()
        setTimeout(() => mediaRecorder.stop(), 3000)
      })
      
      if (!autoRestartRef.current) return
      
      // 처리
      setState('processing')
      setDebugMsg('처리 중...')
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      formData.append('history', JSON.stringify(historyRef.current))
      
      const res = await fetch('/api/talk-whisper', { method: 'POST', body: formData })
      const data = await res.json()
      
      if (!data.ok || !data.transcript) {
        setDebugMsg('인식 안됨 - 다시 듣기')
        if (autoRestartRef.current) recordAndProcess()
        return
      }
      
      setLastHeard(data.transcript)
      setResponse(data.message)
      setDebugMsg('')
      
      // 히스토리 업데이트
      historyRef.current = [...historyRef.current, 
        { role: 'user', content: data.transcript },
        { role: 'assistant', content: data.message }
      ].slice(-10)
      
      // 작별 체크
      const goodbyes = ['잘가', '바이', '끝', '그만', '안녕']
      if (goodbyes.some(g => data.transcript.includes(g))) {
        autoRestartRef.current = false
        setState('speaking')
        await speak(data.message, data.audio)
        setState('init')
        setResponse('')
        setLastHeard('')
        historyRef.current = []
        return
      }
      
      // 응답 말하기
      setState('speaking')
      await speak(data.message, data.audio)
      
      // 다시 듣기
      if (autoRestartRef.current) recordAndProcess()
      
    } catch (e: any) {
      setDebugMsg('에러: ' + e.message)
      if (autoRestartRef.current) setTimeout(recordAndProcess, 1000)
    }
  }

  // 시작
  async function handleStart() {
    setDebugMsg('시작 중...')
    
    try {
      // 오디오 unlock
      const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
      await audio.play().catch(() => {})
      
      // 마이크
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      autoRestartRef.current = true
      
      setDebugMsg('')
      setState('speaking')
      await speak('응! 뭐야?')
      
      recordAndProcess()
      
    } catch (e: any) {
      setDebugMsg('마이크 권한 필요: ' + e.message)
    }
  }

  // 정지
  function handleStop() {
    autoRestartRef.current = false
    setState('init')
    setResponse('')
    setLastHeard('')
    setDebugMsg('')
    historyRef.current = []
  }

  // 정리
  useEffect(() => {
    return () => {
      autoRestartRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // 시작 화면
  if (state === 'init') {
    return (
      <main 
        onClick={handleStart}
        className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200 cursor-pointer select-none"
      >
        <div className="text-9xl mb-8 animate-bounce">🤗</div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        {debugMsg ? (
          <p className="text-lg text-orange-600 mb-8">{debugMsg}</p>
        ) : (
          <p className="text-2xl text-purple-600 mb-8 animate-pulse">화면을 터치해요! 👆</p>
        )}
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200 select-none">
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
          "{lastHeard}"
        </div>
      )}

      {response && (
        <div className="mt-2 p-6 bg-white rounded-3xl shadow-xl max-w-sm text-center">
          <p className="text-2xl text-gray-800 leading-relaxed font-bold">{response}</p>
        </div>
      )}

      {debugMsg && (
        <p className="mt-4 text-sm text-orange-600">{debugMsg}</p>
      )}

      <button
        onClick={handleStop}
        className="fixed bottom-4 right-4 w-10 h-10 bg-gray-400/50 text-white rounded-full"
      >
        ✕
      </button>
    </main>
  )
}
