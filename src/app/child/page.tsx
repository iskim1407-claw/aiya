'use client'

import { useState, useEffect, useRef } from 'react'

type State = 'init' | 'listening' | 'recording' | 'processing' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('init')
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [debugMsg, setDebugMsg] = useState('')
  const [sessionActive, setSessionActive] = useState(false)
  
  const streamRef = useRef<MediaStream | null>(null)
  const historyRef = useRef<{role: string, content: string}[]>([])
  const runningRef = useRef(false)
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // TTS
  async function speak(text: string, audioData?: string): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000)
      
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

  // 녹음
  async function record(seconds: number): Promise<Blob | null> {
    if (!streamRef.current) return null
    
    const mediaRecorder = new MediaRecorder(streamRef.current)
    const chunks: Blob[] = []
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
      mediaRecorder.start()
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop()
      }, seconds * 1000)
    })
  }

  // Whisper 호출
  async function transcribe(audioBlob: Blob, withResponse: boolean = false): Promise<any> {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.webm')
    if (withResponse) {
      formData.append('history', JSON.stringify(historyRef.current))
    }
    
    const res = await fetch('/api/talk-whisper', { method: 'POST', body: formData })
    return res.json()
  }

  // 웨이크 워드 체크
  function isWakeWord(text: string): boolean {
    const wake = ['아이야', '아이얌', '아이아', '아이여', '애야', '이야', '아야', '아이']
    const lower = text.replace(/\s/g, '')
    return wake.some(w => lower.includes(w))
  }

  // 작별 체크
  function isGoodbye(text: string): boolean {
    const bye = ['잘가', '바이', '끝', '그만', '안녕']
    return bye.some(b => text.includes(b))
  }

  // 세션 타이머 리셋
  function resetSessionTimer() {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    sessionTimeoutRef.current = setTimeout(() => {
      endSession()
    }, 30000) // 30초 침묵시 세션 종료
  }

  // 세션 종료
  async function endSession() {
    setSessionActive(false)
    historyRef.current = []
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    
    setState('speaking')
    await speak('또 불러줘!')
    setResponse('')
    setLastHeard('')
    
    // 웨이크 워드 대기로
    listenForWakeWord()
  }

  // 웨이크 워드 대기 루프
  async function listenForWakeWord() {
    setState('listening')
    setDebugMsg('')
    
    while (runningRef.current && !sessionActive) {
      const audioBlob = await record(2)
      if (!audioBlob || !runningRef.current) break
      
      try {
        const data = await transcribe(audioBlob, false)
        if (data.transcript) {
          setLastHeard(data.transcript)
          
          if (isWakeWord(data.transcript)) {
            // 세션 시작!
            setSessionActive(true)
            setState('speaking')
            setResponse('응! 뭐야?')
            await speak('응! 뭐야?')
            
            // 대화 루프 시작
            conversationLoop()
            return
          }
        }
      } catch (e) {
        // 무시
      }
    }
  }

  // 대화 루프
  async function conversationLoop() {
    resetSessionTimer()
    
    while (runningRef.current && sessionActive) {
      setState('recording')
      const audioBlob = await record(3)
      if (!audioBlob || !runningRef.current) break
      
      setState('processing')
      
      try {
        const data = await transcribe(audioBlob, true)
        
        if (!data.transcript) {
          // 인식 안됨 - 계속 듣기
          resetSessionTimer()
          continue
        }
        
        setLastHeard(data.transcript)
        resetSessionTimer()
        
        // 작별 체크
        if (isGoodbye(data.transcript)) {
          setResponse('응! 또 놀자! 👋')
          setState('speaking')
          await speak('응! 또 놀자! 안녕!', data.audio)
          await endSession()
          return
        }
        
        // 히스토리 업데이트
        historyRef.current = [...historyRef.current,
          { role: 'user', content: data.transcript },
          { role: 'assistant', content: data.message }
        ].slice(-10)
        
        setResponse(data.message)
        setState('speaking')
        await speak(data.message, data.audio)
        
      } catch (e) {
        // 에러 - 계속 시도
      }
    }
  }

  // 시작 (부모가 터치)
  async function handleStart() {
    setDebugMsg('마이크 준비 중...')
    
    try {
      // 오디오 unlock
      const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
      await audio.play().catch(() => {})
      
      // 마이크
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      runningRef.current = true
      
      setDebugMsg('')
      
      // 웨이크 워드 대기 시작
      listenForWakeWord()
      
    } catch (e: any) {
      setDebugMsg('마이크 권한이 필요해요!')
    }
  }

  // 정지
  function handleStop() {
    runningRef.current = false
    setSessionActive(false)
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    setState('init')
    setResponse('')
    setLastHeard('')
    historyRef.current = []
  }

  // 정리
  useEffect(() => {
    return () => {
      runningRef.current = false
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
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

  // 웨이크 워드 대기 화면
  if (state === 'listening' && !sessionActive) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-blue-100 via-purple-100 to-pink-100 select-none">
        <div className="text-9xl mb-8">😴</div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className="text-2xl text-purple-600 mb-8">"아이야~" 라고 불러봐!</p>
        
        {lastHeard && (
          <div className="mb-4 px-5 py-2 bg-white/60 rounded-full text-gray-500 text-sm">
            🎧 "{lastHeard}"
          </div>
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

  // 대화 중 화면
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
        <p className="text-sm text-green-600 mt-2">대화 중 💬</p>
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

      <button
        onClick={handleStop}
        className="fixed bottom-4 right-4 w-10 h-10 bg-gray-400/50 text-white rounded-full"
      >
        ✕
      </button>
    </main>
  )
}
