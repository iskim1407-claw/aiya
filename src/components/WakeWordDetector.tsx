'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface WakeWordDetectorProps {
  onWakeWord: (text: string) => void
  isListening?: boolean
}

export default function WakeWordDetector({
  onWakeWord,
  isListening = true,
}: WakeWordDetectorProps) {
  const [status, setStatus] = useState('🔄 시작 중...')
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [isActive, setIsActive] = useState(isListening)
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 안정적인 재시작 함수
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current || isProcessingRef.current) return
    
    try {
      recognitionRef.current.start()
    } catch (e) {
      // 이미 시작된 경우 무시
      console.log('[Recognition] Already started or error:', e)
    }
  }, [])

  // 지연 재시작 (중복 방지)
  const scheduleRestart = useCallback((delayMs: number = 1000) => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
    }
    restartTimeoutRef.current = setTimeout(() => {
      if (isActive && !isProcessingRef.current) {
        startRecognition()
      }
    }, delayMs)
  }, [isActive, startRecognition])

  // 마이크 권한 요청
  useEffect(() => {
    async function requestMicPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        setPermissionGranted(true)
        setStatus('🎤 듣고 있어요...')
      } catch (err) {
        console.error('마이크 권한 거부:', err)
        setStatus('🔒 마이크 권한을 허용해주세요')
        setPermissionGranted(false)
      }
    }
    requestMicPermission()
  }, [])

  useEffect(() => {
    if (!isActive || !permissionGranted) return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus('❌ 음성 인식 미지원')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false  // 모바일 안정성을 위해 false
    recognition.interimResults = true  // 중간 결과도 받기
    recognition.lang = 'ko-KR'
    recognition.maxAlternatives = 1

    recognitionRef.current = recognition

    recognition.onstart = () => {
      setStatus('🎤 듣고 있어요...')
    }

    recognition.onresult = (event: any) => {
      let transcript = ''
      let isFinal = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
        if (event.results[i].isFinal) {
          isFinal = true
        }
      }

      // 웨이크 워드 감지
      const lowerTranscript = transcript.toLowerCase().trim()
      const wakeWords = ['아이야', '아이야!', '아이야~', '아이얌', '아이아', 'aiya', 'ai ya']

      if (wakeWords.some((w) => lowerTranscript.includes(w))) {
        console.log('[웨이크 워드 감지]', transcript)
        isProcessingRef.current = true
        setStatus('✅ 들었어! 말해봐~')
        
        // 현재 인식 중지
        try {
          recognition.stop()
        } catch (e) {}

        // 웨이크 워드 이후 텍스트 추출
        let afterWakeWord = transcript
        for (const w of wakeWords) {
          const idx = lowerTranscript.indexOf(w)
          if (idx !== -1) {
            afterWakeWord = transcript.substring(idx + w.length).trim()
            break
          }
        }

        // 웨이크 워드 후 추가 음성 입력 받기
        setTimeout(() => {
          const listeningRecognition = new SpeechRecognition()
          listeningRecognition.continuous = false
          listeningRecognition.interimResults = false
          listeningRecognition.lang = 'ko-KR'

          let finalText = afterWakeWord

          listeningRecognition.onstart = () => {
            setStatus('🎤 듣고 있어요...')
          }

          listeningRecognition.onresult = (e: any) => {
            for (let i = 0; i < e.results.length; i++) {
              finalText += ' ' + e.results[i][0].transcript
            }
            finalText = finalText.trim()
          }

          listeningRecognition.onerror = (e: any) => {
            console.log('[듣기 오류]', e.error)
          }

          listeningRecognition.onend = () => {
            console.log('[음성 입력 완료]', finalText)
            
            if (finalText) {
              setStatus('💭 생각 중...')
              onWakeWord(finalText)
            } else {
              setStatus('🎤 듣고 있어요...')
            }
            
            // 처리 완료 후 메인 인식 재시작
            isProcessingRef.current = false
            scheduleRestart(1500)
          }

          try {
            listeningRecognition.start()
          } catch (e) {
            console.error('[듣기 시작 실패]', e)
            isProcessingRef.current = false
            scheduleRestart(1000)
          }
        }, 300)

        return
      }

      // 웨이크 워드 없으면 계속 듣기
      if (isFinal && !wakeWords.some((w) => lowerTranscript.includes(w))) {
        console.log('[일반 음성]', transcript)
      }
    }

    recognition.onerror = (event: any) => {
      console.log('[인식 오류]', event.error)
      
      if (event.error === 'not-allowed') {
        setStatus('🔒 마이크 권한 필요')
        return
      }
      
      if (event.error === 'no-speech') {
        setStatus('🎤 듣고 있어요...')
        scheduleRestart(500)
        return
      }

      setStatus('⚠️ 다시 시도 중...')
      scheduleRestart(2000)
    }

    recognition.onend = () => {
      if (!isProcessingRef.current && isActive) {
        scheduleRestart(800)
      }
    }

    // 초기 시작
    startRecognition()

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      try {
        recognition.stop()
      } catch (e) {}
    }
  }, [isActive, permissionGranted, onWakeWord, scheduleRestart, startRecognition])

  return (
    <div className="fixed bottom-4 left-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-3 rounded-full text-lg font-semibold shadow-lg">
      {status}
    </div>
  )
}
