import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import getDb from '@/lib/db'

/**
 * POST /api/talk
 * 아이 음성 입력 → LLM 응답 → 텍스트 반환
 * 
 * TODO: STT (Whisper) 연동
 * TODO: TTS (Kokoro/MeloTTS) 연동
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

    // Step 1: STT (임시 - 실제로는 Whisper.cpp 또는 API 사용)
    const childText = await performSTT(audioFile)
    console.log('[STT Result]', childText)

    // Step 2: 부모 설정 조회
    const db = getDb()
    const parentSettings = getParentSettings(db, childId)

    // Step 3: 시간 제한 확인
    if (!isAllowedTime(parentSettings)) {
      const restrictedMessage = '지금은 아이야를 사용할 수 없는 시간입니다.'
      saveConversation(db, childId, childText, restrictedMessage)
      return NextResponse.json({
        ok: true,
        message: restrictedMessage,
        audioUrl: null,
      })
    }

    // Step 4: LLM (Ollama 연동)
    const aiResponse = await performLLM(childText, parentSettings)
    console.log('[LLM Response]', aiResponse)

    // Step 5: TTS (Kokoro-82M 또는 MeloTTS)
    const audioUrl = await performTTS(aiResponse, parentSettings.voicePreference)

    // Step 6: 대화 기록 저장
    saveConversation(db, childId, childText, aiResponse)

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
 * Flask 서버의 Whisper API와 연동
 */
async function performSTT(audioFile: File): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('audio', audioFile)

    // Flask STT 서버 호출
    const response = await fetch('http://localhost:5000/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error('[STT Error]', response.status)
      throw new Error(`STT API 오류: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.ok && data.text) {
      console.log('[STT Success]', data.text)
      return data.text
    } else {
      console.error('[STT Failed]', data.error)
      throw new Error(data.error || 'STT 실패')
    }
  } catch (error) {
    console.error('[STT Exception]', error)
    // 폴백: 더미 응답
    const dummyInputs = [
      '안녕',
      '뭐 해줄까',
      '심심해',
      '이야기 해줘',
      '노래 불러줘',
    ]
    return dummyInputs[Math.floor(Math.random() * dummyInputs.length)]
  }
}

/**
 * LLM: 텍스트 → AI 응답
 * 현재: 키워드 기반
 * 향후: Ollama llama2:3b 또는 더 나은 모델
 */
async function performLLM(childText: string, settings: any): Promise<string> {
  // 아이 눈높이에 맞는 응답 생성
  const keyword = childText.toLowerCase()

  // 키워드 기반 응답 (향후 LLM으로 대체)
  if (keyword.includes('심심') || keyword.includes('뭐')) {
    const activities = [
      '그래? 그럼 재미있는 이야기 해줄까?',
      '좋은 생각이야! 어떤 이야기가 좋아?',
      '함께 놀아볼까? 숨바꼭질? 아니면 이야기?',
    ]
    return activities[Math.floor(Math.random() * activities.length)]
  }

  if (keyword.includes('이야기') || keyword.includes('책')) {
    return '좋은 생각이야! 옛날 옛날에... 를 듣고 싶어?'
  }

  if (keyword.includes('노래') || keyword.includes('부를')) {
    return '♪ 반짝 반짝 작은 별 ♪ 불러줄까?'
  }

  if (keyword.includes('슬') || keyword.includes('못')) {
    return '괜찮아, 안아줄까? 기분이 어때?'
  }

  // 기본 응답
  const defaultResponses = [
    '응! 뭐 해줄까?',
    '좋은 생각이야!',
    '그래? 말해봐!',
    '맞아! 재미있겠다!',
  ]
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
}

/**
 * TTS: 텍스트 → 음성 파일
 * 현재: 더미 (null)
 * 향후: Kokoro-82M 또는 MeloTTS 연동
 */
async function performTTS(text: string, voicePreference: string): Promise<string | null> {
  // TODO: Kokoro-82M 또는 MeloTTS 연동
  // 더미 구현으로 현재 테스트
  return null
}

/**
 * 부모 설정 조회
 */
function getParentSettings(db: any, childId: string): any {
  const settings = db
    .prepare(`SELECT * FROM parentSettings WHERE childId = ?`)
    .get(childId) as any

  return (
    settings || {
      dailyLimitMinutes: 60,
      allowedStartTime: '09:00',
      allowedEndTime: '21:00',
      voicePreference: 'mom',
    }
  )
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
 * 대화 기록 저장
 */
function saveConversation(db: any, childId: string, childText: string, aiResponse: string): void {
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
