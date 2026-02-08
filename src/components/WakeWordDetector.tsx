'use client'

import { useEffect, useState } from 'react'

interface WakeWordDetectorProps {
  onWakeWord: (text: string) => void
  isListening?: boolean
}

export default function WakeWordDetector({
  onWakeWord,
  isListening = true,
}: WakeWordDetectorProps) {
  const [status, setStatus] = useState('대기 중...')
  const [isActive, setIsActive] = useState(isListening)

  useEffect(() => {
    if (!isActive) return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus('음성 인식 미지원')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'ko-KR'

    recognition.onstart = () => {
      setStatus('🎤 듣고 있어요...')
    }

    recognition.onresult = (event: any) => {
      let transcript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const isFinal = event.results[i].isFinal
        transcript += event.results[i][0].transcript

        // 웨이크 워드 감지 (여러 변형)
        const lowerTranscript = transcript.toLowerCase().trim()
        const wakeWords = ['아이야', '아이야!', '아이야~', 'aiya', 'ai ya']

        if (wakeWords.some((w) => lowerTranscript.includes(w))) {
          console.log('[웨이크 워드 감지]', transcript)
          setStatus('✅ 감지됨! 말씀해주세요')
          
          // 웨이크 워드 후 3초 동안 음성 입력 받기
          const listeningRecognition = new SpeechRecognition()
          listeningRecognition.continuous = false
          listeningRecognition.interimResults = false
          listeningRecognition.lang = 'ko-KR'
          listeningRecognition.maxAlternatives = 1

          let fullText = ''

          listeningRecognition.onstart = () => {
            setStatus('🎤 듣고 있어요...')
          }

          listeningRecognition.onresult = (listenEvent: any) => {
            for (let i = listenEvent.resultIndex; i < listenEvent.results.length; i++) {
              fullText += listenEvent.results[i][0].transcript
            }
            console.log('[음성 입력]', fullText)
            setStatus('처리 중...')
            onWakeWord(fullText)
          }

          listeningRecognition.onerror = (error: any) => {
            console.error('[음성 인식 오류]', error)
            setStatus('🎤 듣고 있어요...')
            recognition.start() // 웨이크 워드 대기로 돌아가기
          }

          listeningRecognition.onend = () => {
            console.log('[음성 입력 종료]')
            setStatus('🎤 듣고 있어요...')
            recognition.start() // 웨이크 워드 대기로 돌아가기
          }

          listeningRecognition.start()
          recognition.stop()
          
          return
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.error('[인식 오류]', event.error)
      setStatus('⚠️ 오류 발생, 다시 시도 중...')
      setTimeout(() => recognition.start(), 1000)
    }

    recognition.onend = () => {
      console.log('[음성 인식 종료, 재시작]')
      setStatus('🎤 듣고 있어요...')
      if (isActive) {
        setTimeout(() => recognition.start(), 500)
      }
    }

    recognition.start()

    return () => {
      recognition.stop()
    }
  }, [isActive, onWakeWord])

  return (
    <div className="fixed bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-full text-sm">
      {status}
    </div>
  )
}
