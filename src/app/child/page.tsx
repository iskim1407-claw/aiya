'use client'

import { useState, useEffect, useRef } from 'react'

type State = 'init' | 'listening' | 'recording' | 'processing' | 'speaking'

export default function ChildPage() {
  const [state, setState] = useState<State>('init')
  const [response, setResponse] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [debugMsg, setDebugMsg] = useState('')
  
  const streamRef = useRef<MediaStream | null>(null)
  const historyRef = useRef<{role: string, content: string}[]>([])
  const runningRef = useRef(false)
  const inSessionRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // TTS
  async function speak(text: string, audioData?: string): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, 5000)
      if (audioData) {
        const a = new Audio(audioData)
        a.onended = () => { clearTimeout(t); resolve() }
        a.onerror = () => { clearTimeout(t); resolve() }
        a.play().catch(() => { clearTimeout(t); resolve() })
      } else {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'ko-KR'
        u.rate = 0.9
        u.onend = () => { clearTimeout(t); resolve() }
        u.onerror = () => { clearTimeout(t); resolve() }
        window.speechSynthesis.speak(u)
      }
    })
  }

  // 녹음
  async function record(sec: number): Promise<Blob | null> {
    if (!streamRef.current) return null
    const mr = new MediaRecorder(streamRef.current)
    const chunks: Blob[] = []
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    return new Promise((resolve) => {
      mr.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
      mr.start()
      setTimeout(() => { if (mr.state === 'recording') mr.stop() }, sec * 1000)
    })
  }

  // Whisper
  async function transcribe(blob: Blob, withReply: boolean): Promise<any> {
    const fd = new FormData()
    fd.append('audio', blob, 'a.webm')
    if (withReply) fd.append('history', JSON.stringify(historyRef.current))
    const r = await fetch('/api/talk-whisper', { method: 'POST', body: fd })
    return r.json()
  }

  // 웨이크워드 체크
  const isWake = (t: string) => ['아이야','아이얌','아이아','아이여','애야','이야','아야'].some(w => t.includes(w))
  
  // 작별 체크
  const isBye = (t: string) => ['잘가','바이','끝','그만','안녕'].some(w => t.includes(w))

  // 세션 종료
  async function endSession() {
    inSessionRef.current = false
    historyRef.current = []
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setState('speaking')
    await speak('또 불러줘!')
    setResponse('')
    setLastHeard('')
    wakeLoop()
  }

  // 웨이크워드 루프
  async function wakeLoop() {
    setState('listening')
    while (runningRef.current && !inSessionRef.current) {
      const blob = await record(2)
      if (!blob || !runningRef.current) break
      try {
        const d = await transcribe(blob, false)
        if (d.transcript) {
          setLastHeard(d.transcript)
          if (isWake(d.transcript)) {
            inSessionRef.current = true
            setState('speaking')
            setResponse('응! 뭐야?')
            await speak('응! 뭐야?')
            talkLoop()
            return
          }
        }
      } catch {}
    }
  }

  // 대화 루프
  async function talkLoop() {
    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(endSession, 30000)
    }
    resetTimer()
    
    while (runningRef.current && inSessionRef.current) {
      setState('recording')
      const blob = await record(3)
      if (!blob || !runningRef.current) break
      
      setState('processing')
      try {
        const d = await transcribe(blob, true)
        if (!d.transcript) { resetTimer(); continue }
        
        setLastHeard(d.transcript)
        resetTimer()
        
        if (isBye(d.transcript)) {
          setResponse('응! 또 놀자! 👋')
          setState('speaking')
          await speak('응! 또 놀자!', d.audio)
          endSession()
          return
        }
        
        historyRef.current = [...historyRef.current,
          { role: 'user', content: d.transcript },
          { role: 'assistant', content: d.message }
        ].slice(-10)
        
        setResponse(d.message)
        setState('speaking')
        await speak(d.message, d.audio)
      } catch {}
    }
  }

  // 시작
  async function handleStart() {
    setDebugMsg('마이크 준비 중...')
    try {
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
      await a.play().catch(() => {})
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      runningRef.current = true
      setDebugMsg('')
      wakeLoop()
    } catch {
      setDebugMsg('마이크 권한 필요!')
    }
  }

  // 정지
  function handleStop() {
    runningRef.current = false
    inSessionRef.current = false
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setState('init')
    setResponse('')
    setLastHeard('')
  }

  useEffect(() => () => {
    runningRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  if (state === 'init') {
    return (
      <main onClick={handleStart} className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200 cursor-pointer">
        <div className="text-9xl mb-8 animate-bounce">🤗</div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className="text-2xl text-purple-600 mb-8 animate-pulse">{debugMsg || '화면을 터치해요! 👆'}</p>
      </main>
    )
  }

  if (state === 'listening') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-blue-100 via-purple-100 to-pink-100">
        <div className="text-9xl mb-8">😴</div>
        <h1 className="text-5xl font-bold text-purple-800 mb-4">아이야!</h1>
        <p className="text-2xl text-purple-600 mb-8">"아이야~" 불러봐!</p>
        {lastHeard && <p className="text-gray-500">🎧 {lastHeard}</p>}
        <button onClick={handleStop} className="fixed bottom-4 right-4 w-10 h-10 bg-gray-400/50 text-white rounded-full">✕</button>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-pink-200 via-purple-100 to-blue-200">
      <div className={`text-8xl mb-4 ${state === 'recording' ? 'animate-bounce' : 'animate-pulse'}`}>
        {state === 'recording' ? '👂' : state === 'processing' ? '🤔' : '🗣️'}
      </div>
      <h1 className="text-4xl font-bold text-purple-800 mb-2">아이야!</h1>
      <p className="text-purple-600 mb-4">
        {state === 'recording' ? '듣는 중...' : state === 'processing' ? '생각 중...' : '말하는 중...'}
      </p>
      {lastHeard && <p className="bg-white/60 px-4 py-2 rounded-full mb-4">"{lastHeard}"</p>}
      {response && <div className="bg-white p-6 rounded-3xl shadow-xl max-w-sm"><p className="text-xl font-bold">{response}</p></div>}
      <button onClick={handleStop} className="fixed bottom-4 right-4 w-10 h-10 bg-gray-400/50 text-white rounded-full">✕</button>
    </main>
  )
}
