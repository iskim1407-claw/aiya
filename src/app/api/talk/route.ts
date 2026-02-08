import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/talk
 * 아이 음성 입력 → 키워드 기반 응답
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const childText = body.text || ''
    
    if (!childText.trim()) {
      return NextResponse.json(
        { ok: false, error: '뭐라고 했어? 다시 말해볼까?' },
        { status: 400 }
      )
    }

    // 키워드 기반 응답 (DB 없이)
    const aiResponse = getKeywordResponse(childText)

    return NextResponse.json({
      ok: true,
      message: aiResponse,
    })
  } catch (error: any) {
    console.error('[API Error]', error)
    return NextResponse.json(
      { ok: false, error: `오류: ${error?.message || '알 수 없는 오류'}` },
      { status: 500 }
    )
  }
}

/**
 * 키워드 기반 응답
 */
function getKeywordResponse(childText: string): string {
  const text = childText.toLowerCase()

  // 인사
  if (text.includes('안녕') || text.includes('헬로') || text.includes('하이')) {
    const greetings = [
      '안녕! 오늘 기분이 어때?',
      '안녕! 뭐 하고 있었어?',
      '반가워! 오늘 뭐 하고 싶어?',
      '안녕 안녕! 나는 아이야야!'
    ]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  // 이름/소개
  if (text.includes('누구') || text.includes('이름') || text.includes('뭐야')) {
    return '나는 아이야! 네 친구야! 뭐든 물어봐~'
  }

  // 가족
  if (text.includes('엄마') || text.includes('아빠') || text.includes('할머니') || text.includes('할아버지')) {
    const family = [
      '엄마 아빠 좋아해?',
      '가족이랑 뭐 하고 싶어?',
      '엄마 아빠한테 사랑한다고 말해봐!'
    ]
    return family[Math.floor(Math.random() * family.length)]
  }

  // 음식
  if (text.includes('배고') || text.includes('먹') || text.includes('밥') || text.includes('간식')) {
    const food = [
      '배고파? 맛있는 거 먹고 싶어?',
      '뭐 먹고 싶어? 나는 아이스크림 좋아해!',
      '밥 먹을 시간이야? 골고루 먹어야 해~'
    ]
    return food[Math.floor(Math.random() * food.length)]
  }

  // 놀이
  if (text.includes('놀') || text.includes('게임') || text.includes('재미')) {
    const plays = [
      '좋아! 뭐 하고 놀까?',
      '오! 같이 놀자! 뭐가 좋아?',
      '놀이 좋지! 블록 쌓기 해볼까?'
    ]
    return plays[Math.floor(Math.random() * plays.length)]
  }

  // 심심
  if (text.includes('심심') || text.includes('뭐할') || text.includes('뭐해')) {
    const bored = [
      '심심해? 그럼 노래 불러줄까?',
      '뭐 하고 놀까? 수수께끼 맞춰볼래?',
      '나랑 이야기하자! 오늘 뭐 했어?'
    ]
    return bored[Math.floor(Math.random() * bored.length)]
  }

  // 이야기/동화
  if (text.includes('이야기') || text.includes('동화') || text.includes('책')) {
    return '좋아! 옛날 옛날에... 토끼 한 마리가 살았어. 토끼는 깡충깡충 뛰어다니는 걸 좋아했지!'
  }

  // 노래
  if (text.includes('노래') || text.includes('음악') || text.includes('불러')) {
    const songs = [
      '♪ 반짝 반짝 작은 별~ 아름답게 비치네~ ♪',
      '♪ 나비야 나비야~ 이리 날아 오너라~ ♪',
      '♪ 곰 세 마리가 한 집에 있어~ 아빠곰 엄마곰 애기곰~ ♪'
    ]
    return songs[Math.floor(Math.random() * songs.length)]
  }

  // 동물
  if (text.includes('강아지') || text.includes('고양이') || text.includes('동물') || text.includes('멍멍') || text.includes('야옹')) {
    const animals = [
      '멍멍! 강아지 좋아해? 나도 좋아!',
      '야옹~ 고양이는 귀엽지!',
      '어떤 동물 좋아해? 나는 토끼!'
    ]
    return animals[Math.floor(Math.random() * animals.length)]
  }

  // 감정 - 슬픔
  if (text.includes('슬') || text.includes('울') || text.includes('눈물')) {
    const sad = [
      '왜 슬퍼? 안아줄까?',
      '괜찮아, 내가 옆에 있어~',
      '힘내! 좋은 일이 생길 거야!'
    ]
    return sad[Math.floor(Math.random() * sad.length)]
  }

  // 감정 - 기쁨
  if (text.includes('좋아') || text.includes('행복') || text.includes('신나')) {
    const happy = [
      '와~ 좋겠다! 나도 기분 좋아!',
      '신난다! 뭐가 좋았어?',
      '행복해? 나도 행복해!'
    ]
    return happy[Math.floor(Math.random() * happy.length)]
  }

  // 잠/피곤
  if (text.includes('자') || text.includes('졸려') || text.includes('피곤')) {
    return '졸려? 푹 자고 내일 또 놀자! 잘 자~'
  }

  // 사랑
  if (text.includes('사랑') || text.includes('좋아해')) {
    return '나도 좋아해! 우리 친구야!'
  }

  // 고마워
  if (text.includes('고마') || text.includes('감사')) {
    return '천만에! 또 물어봐~'
  }

  // 기본 응답
  const defaults = [
    '응! 뭐 해줄까?',
    '그래? 재미있겠다!',
    '오! 더 말해봐!',
    '좋아 좋아! 또 뭐 있어?',
    '우와~ 신기하다!',
    '그렇구나! 나도 해보고 싶어!'
  ]
  return defaults[Math.floor(Math.random() * defaults.length)]
}
