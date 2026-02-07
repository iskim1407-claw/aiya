import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import getDb from '@/lib/db'

/**
 * 간단한 버전 - STT/TTS 없이 텍스트만 처리
 * 프로덕션에서는 Whisper API + Kokoro TTS 연동
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const childId = formData.get('childId') as string || 'default-child'

    if (!audioFile) {
      return NextResponse.json(
        { ok: false, error: '음성 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // Step 1: STT (Whisper 대체 - 임시로 더미 텍스트)
    const childText = await performSTT(audioFile)
    console.log('[STT]', childText)

    // Step 2: 부모 설정 확인
    const db = getDb()
    const settings = db.prepare(`
      SELECT * FROM parentSettings WHERE childId = ?
    `).get(childId) as any

    const parentSettings = settings || {
      dailyLimitMinutes: 60,
      allowedStartTime: '00:00',
      allowedEndTime: '23:59',
      voicePreference: 'mom',
    }

    // Step 3: 시간 확인
    if (!isAllowedTime(parentSettings)) {
      const response = '지금은 사용할 수 없는 시간입니다.'
      saveConversation(db, childId, childText, response)
      return NextResponse.json({
        ok: true,
        message: response,
        audioUrl: null,
      })
    }

    // Step 4: LLM 응답
    const aiResponse = await performLLM(childText, parentSettings)
    console.log('[LLM]', aiResponse)

    // Step 5: TTS (임시 스킵)
    const audioUrl = null

    // Step 6: 대화 기록 저장
    saveConversation(db, childId, childText, aiResponse)

    return NextResponse.json({
      ok: true,
      message: aiResponse,
      audioUrl,
    })
  } catch (error) {
    console.error('[ERROR]', error)
    return NextResponse.json(
      { ok: false, error: '오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// STT 더미 구현
async function performSTT(audioFile: File): Promise<string> {
  // TODO: 실제로는 Whisper API 호출
  return '안녕'
}

// LLM 구현
async function performLLM(childText: string, settings: any): Promise<string> {
  // 아이용 응답 생성 로직
  const responses: { [key: string]: string[] } = {
    기본: ['응! 뭐 해줄까?', '안녕! 반가워!', '네, 알겠어!'],
    놀이: ['그래? 재미있는 이야기 해줄까!', '좋은 생각이야!'],
    교육: ['좋은 질문이야!', '함께 배워봐!'],
    감정: ['괜찮아, 안아줄까?', '기분이 어때?'],
  }

  // 간단한 키워드 매칭
  if (childText.includes('심심')) {
    return responses.놀이[Math.floor(Math.random() * responses.놀이.length)]
  }
  if (childText.includes('뭐')) {
    return responses.놀이[0]
  }
  if (childText.includes('슬') || childText.includes('우')) {
    return responses.감정[0]
  }

  return responses.기본[Math.floor(Math.random() * responses.기본.length)]
}

// 시간 확인
function isAllowedTime(settings: any): boolean {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hours}:${minutes}`

  const start = settings.allowedStartTime || '00:00'
  const end = settings.allowedEndTime || '23:59'

  return currentTime >= start && currentTime <= end
}

// 대화 저장
function saveConversation(db: any, childId: string, childText: string, aiResponse: string) {
  const childMsgId = uuidv4()
  const aiMsgId = uuidv4()

  db.prepare(`
    INSERT INTO conversations (id, childId, type, text, timestamp)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(childMsgId, childId, 'child', childText)

  db.prepare(`
    INSERT INTO conversations (id, childId, type, text, timestamp)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(aiMsgId, childId, 'ai', aiResponse)
}
