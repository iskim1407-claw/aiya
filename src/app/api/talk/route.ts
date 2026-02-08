import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import getDb from '@/lib/db'

/**
 * POST /api/talk
 * 아이 음성 입력 → LLM 응답 → 텍스트 반환
 */
export async function POST(request: NextRequest) {
  try {
    let childText: string
    let childId: string
    
    // 1. JSON 요청 (텍스트 직접)
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const body = await request.json()
      childText = body.text
      childId = body.childId || 'default-child'
      
      if (!childText) {
        return NextResponse.json(
          { ok: false, error: '텍스트 또는 음성이 필요합니다.' },
          { status: 400 }
        )
      }
    } 
    // 2. FormData 요청 (음성 파일)
    else {
      const formData = await request.formData()
      const audioFile = formData.get('audio') as File
      childId = (formData.get('childId') as string) || 'default-child'

      if (!audioFile) {
        return NextResponse.json(
          { ok: false, error: '음성 파일이 필요합니다.' },
          { status: 400 }
        )
      }
      
      // STT 처리
      childText = await performSTT(audioFile)
    }

    // Step 2: 부모 설정 조회
    const db = getDb()
    const parentSettings = await getParentSettings(db, childId)

    // Step 3: 시간 제한 확인
    if (!isAllowedTime(parentSettings)) {
      const restrictedMessage = '지금은 아이야를 사용할 수 없는 시간입니다.'
      await saveConversation(db, childId, childText, restrictedMessage)
      return NextResponse.json({
        ok: true,
        message: restrictedMessage,
        audioUrl: null,
      })
    }

    // Step 4: LLM (키워드 기반)
    const aiResponse = await performLLM(childText, parentSettings)
    console.log('[LLM Response]', aiResponse)

    // Step 5: TTS (현재 null)
    const audioUrl = await performTTS(aiResponse, parentSettings.voicePreference)

    // Step 6: 대화 기록 저장
    await saveConversation(db, childId, childText, aiResponse)

    return NextResponse.json({
      ok: true,
      message: aiResponse,
      audioUrl,
    })
  } catch (error) {
    console.error('[API Error]', error)
    return NextResponse.json(
      { ok: false, error: '오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * STT: 음성 파일 → 텍스트
 */
async function performSTT(audioFile: File): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('audio', audioFile)

    const response = await fetch('http://localhost:5000/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(`STT API 오류: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.ok && data.text) {
      return data.text
    } else {
      throw new Error(data.error || 'STT 실패')
    }
  } catch (error) {
    console.error('[STT Exception]', error)
    const dummyInputs = ['안녕', '뭐 해줄까', '심심해', '이야기 해줘', '노래 불러줘']
    return dummyInputs[Math.floor(Math.random() * dummyInputs.length)]
  }
}

/**
 * LLM: 텍스트 → AI 응답 (키워드 기반)
 */
async function performLLM(childText: string, settings: any): Promise<string> {
  return fallbackKeywordResponse(childText)
}

/**
 * 키워드 기반 응답
 */
function fallbackKeywordResponse(childText: string): string {
  const keyword = childText.toLowerCase()

  if (keyword.includes('안녕') || keyword.includes('헬로')) {
    const greetings = ['안녕! 오늘 기분이 좋아?', '안녕하세요! 뭐 하고 있어?', '반가워! 뭐 하고 싶어?']
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  if (keyword.includes('엄마') || keyword.includes('아빠')) {
    return '엄마, 아빠가 어디 있어?'
  }

  if (keyword.includes('배고') || keyword.includes('먹') || keyword.includes('밥')) {
    return '배고파? 맛있는 거 먹고 싶어?'
  }

  if (keyword.includes('놀') || keyword.includes('게임')) {
    const plays = ['좋아! 뭘 가지고 놀고 싶어?', '오! 함께 놀아볼까?', '재미있게 놀자!']
    return plays[Math.floor(Math.random() * plays.length)]
  }

  if (keyword.includes('심심') || keyword.includes('뭐할')) {
    const activities = ['그래? 그럼 이야기 해줄까?', '재미있는 거 생각해보자!', '함께 놀아볼까?']
    return activities[Math.floor(Math.random() * activities.length)]
  }

  if (keyword.includes('이야기') || keyword.includes('책')) {
    return '좋은 생각이야! 옛날 옛날에... 있었어'
  }

  if (keyword.includes('노래')) {
    return '♪ 반짝 반짝 작은 별 ♪'
  }

  if (keyword.includes('슬') || keyword.includes('싫') || keyword.includes('짜증')) {
    const comforts = ['괜찮아, 안아줄까?', '뭐가 슬퍼? 말해봐', '힘내, 함께 할게']
    return comforts[Math.floor(Math.random() * comforts.length)]
  }

  const defaultResponses = ['응! 뭐 해줄까?', '좋은 생각이야!', '그래? 말해봐!', '오! 재미있겠는데?']
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
}

/**
 * TTS: 텍스트 → 음성 (현재 미구현)
 */
async function performTTS(text: string, voicePreference: string): Promise<string | null> {
  return null
}

/**
 * 부모 설정 조회 (비동기)
 */
async function getParentSettings(db: any, childId: string): Promise<any> {
  const result = await db.execute({
    sql: 'SELECT * FROM parentSettings WHERE childId = ?',
    args: [childId]
  })

  const settings = result.rows[0]

  return settings || {
    dailyLimitMinutes: 60,
    allowedStartTime: '09:00',
    allowedEndTime: '21:00',
    voicePreference: 'mom',
  }
}

/**
 * 시간 제한 확인
 */
function isAllowedTime(settings: any): boolean {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hours}:${minutes}`

  const start = settings.allowedStartTime || '00:00'
  const end = settings.allowedEndTime || '23:59'

  return currentTime >= start && currentTime <= end
}

/**
 * 대화 기록 저장 (비동기)
 */
async function saveConversation(db: any, childId: string, childText: string, aiResponse: string): Promise<void> {
  const childMsgId = uuidv4()
  const aiMsgId = uuidv4()

  await db.execute({
    sql: `INSERT INTO conversations (id, childId, type, text, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`,
    args: [childMsgId, childId, 'child', childText]
  })

  await db.execute({
    sql: `INSERT INTO conversations (id, childId, type, text, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`,
    args: [aiMsgId, childId, 'ai', aiResponse]
  })
}
