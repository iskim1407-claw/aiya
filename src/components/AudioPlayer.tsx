'use client'

/**
 * 텍스트 → 음성 (Web Speech Synthesis API)
 * 브라우저 내장, 한국어 지원, 실시간
 */

export function speakText(text: string, voicePreference: 'mom' | 'narrator' | 'character' = 'mom') {
  if (typeof window === 'undefined') return

  // 이전 음성 중단
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  
  // 한국어 설정
  utterance.lang = 'ko-KR'
  utterance.rate = 1.0  // 속도
  utterance.pitch = voicePreference === 'character' ? 1.5 : 1.0
  utterance.volume = 1.0

  // 음성 선택 (브라우저의 사용 가능한 음성 사용)
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    // 한국어 음성 찾기
    const koVoice = voices.find(v => v.lang.includes('ko'))
    if (koVoice) {
      utterance.voice = koVoice
    }
  }

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') {
    window.speechSynthesis.cancel()
  }
}

export default function AudioPlayer({ text }: { text: string }) {
  return (
    <button
      onClick={() => speakText(text)}
      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
    >
      🔊 음성 듣기
    </button>
  )
}
