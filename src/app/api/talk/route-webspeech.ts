/**
 * Web Speech API 또는 간단한 STT 구현
 * 
 * 옵션:
 * 1. Web Speech API (브라우저, 한국어 지원 약함)
 * 2. OpenAI Whisper API (클라우드, 유료)
 * 3. Google Cloud Speech-to-Text (클라우드, 유료)
 */

// Web Speech API는 클라이언트 사이드에서만 동작하므로
// src/components/RecordButton.tsx에서 직접 구현하면 됨

// 대신 여기서는 더미 응답을 훨씬 개선하자

const childResponses: {[key: string]: string[]} = {
  // 인사
  인사: ['안녕! 반가워!', '응! 뭐 해줄까?', '안녕하세요!'],
  
  // 감정
  슬픔: ['괜찮아, 안아줄까?', '울지 말고 웃어봐!', '뭐가 슬파?'],
  기쁨: ['나도 좋아! 재미있겠다!', '그래? 신났다!'],
  
  // 요청
  이야기: ['좋아! 옛날 옛날에...', '어떤 이야기가 좋아?'],
  노래: ['♪ 반짝 반짝 작은 별 ♪', '같이 노래 불러볼까?'],
  놀이: ['그래? 놀아볼까?', '좋은 생각이야!', '재미있을 것 같은데!'],
  
  // 기본
  기본: ['응! 좋은 생각이야!', '맞아!', '그래? 말해봐!']
}

export function smartResponse(text: string): string {
  const lower = text.toLowerCase()
  
  // 키워드 매칭
  if (lower.includes('안녕') || lower.includes('하이') || lower.includes('hello')) {
    return getRandomResponse('인사')
  }
  
  if (lower.includes('슬') || lower.includes('우') || lower.includes('울')) {
    return getRandomResponse('슬픔')
  }
  
  if (lower.includes('기분') || lower.includes('좋') || lower.includes('재미')) {
    return getRandomResponse('기쁨')
  }
  
  if (lower.includes('이야기') || lower.includes('책') || lower.includes('동화')) {
    return getRandomResponse('이야기')
  }
  
  if (lower.includes('노래') || lower.includes('부를') || lower.includes('음악')) {
    return getRandomResponse('노래')
  }
  
  if (lower.includes('놀') || lower.includes('게임') || lower.includes('심심')) {
    return getRandomResponse('놀이')
  }
  
  // 기본
  return getRandomResponse('기본')
}

function getRandomResponse(category: string): string {
  const responses = childResponses[category] || childResponses['기본']
  return responses[Math.floor(Math.random() * responses.length)]
}
