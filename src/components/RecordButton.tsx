'use client'

import { useState, useRef, useEffect } from 'react'

interface RecordButtonProps {
  onAudioReady: (blob: Blob) => void
  isLoading?: boolean
}

// Web Speech API 타입
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function RecordButton({ onAudioReady, isLoading = false }: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)
  const [usingSpeechAPI, setUsingSpeechAPI] = useState(false)

  // Web Speech API 설정
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        setUsingSpeechAPI(true)
        
        // 한국어 설정
        recognitionRef.current.lang = 'ko-KR'
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.maxAlternatives = 1
      }
    }
  }, [])

  const handleStart = async () => {
    setIsRecording(true)

    // Web Speech API 우선 사용
    if (usingSpeechAPI && recognitionRef.current) {
      try {
        recognitionRef.current.onstart = () => {
          console.log('[Speech API] 인식 시작...')
        }

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
          
          console.log('[Speech API] 인식 완료:', transcript)
          
          // 텍스트를 Blob으로 변환해서 전송 (임시)
          // 실제로는 바로 API로 전송
          sendText(transcript)
          setIsRecording(false)
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error('[Speech API Error]', event.error)
          // 폴백: 마이크 녹음 사용
          fallbackToAudioRecording()
        }

        recognitionRef.current.start()
      } catch (error) {
        console.error('Web Speech API 오류:', error)
        fallbackToAudioRecording()
      }
    } else {
      fallbackToAudioRecording()
    }
  }

  const fallbackToAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/wav',
      })
      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        onAudioReady(blob)
        stream.getTracks().forEach(track => track.stop())
        setIsRecording(false)
      }

      mediaRecorder.start()
    } catch (error) {
      console.error('마이크 접근 실패:', error)
      alert('마이크를 허용해주세요')
      setIsRecording(false)
    }
  }

  const handleStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsRecording(false)
  }

  // 텍스트를 직접 API로 전송
  const sendText = async (text: string) => {
    try {
      const response = await fetch('/api/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, // 텍스트 직접 전송
          childId: 'default-child',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[API Response]', data)
        // 응답을 받으면 부모 컴포넌트가 처리함
        // (onAudioReady 콜백으로 전달되지 않으므로 주의)
      }
    } catch (error) {
      console.error('[API Error]', error)
    }
  }

  return (
    <button
      onMouseDown={handleStart}
      onMouseUp={handleStop}
      onTouchStart={handleStart}
      onTouchEnd={handleStop}
      disabled={isLoading}
      className={`w-40 h-40 rounded-full text-5xl font-bold text-white shadow-2xl transition-all ${
        isRecording
          ? 'bg-gradient-to-br from-red-500 to-red-600 scale-110 animate-pulse'
          : 'bg-gradient-to-br from-blue-400 to-blue-600 hover:scale-110 active:scale-95'
      } ${
        isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {isLoading ? '⏳' : '🎙️'}
    </button>
  )
}
