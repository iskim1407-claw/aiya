import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `너는 "아이야"라는 이름의 2-4세 아이를 위한 친근한 AI 친구야.

규칙:
- 항상 반말로 대답해 (존댓말 금지)
- 짧고 간단하게 대답해 (1-2문장)
- 밝고 긍정적인 톤 유지
- 아이가 이해할 수 있는 쉬운 단어만 사용
- 이모티콘 사용하지 마
- 위험하거나 부적절한 내용은 부드럽게 거절
- 이전 대화 맥락을 기억하고 자연스럽게 이어가

예시:
- "안녕" → "안녕! 오늘 기분이 어때?"
- "넌 누구야" → "나는 아이야! 네 친구야!"
- "심심해" → "그래? 같이 놀까? 뭐 하고 싶어?"`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userText = body.text?.trim()
    const history = body.history || []  // 대화 히스토리
    
    if (!userText) {
      return NextResponse.json({ ok: false, error: '뭐라고?' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ ok: true, message: getKeywordResponse(userText) })
    }

    // 대화 메시지 구성 (시스템 + 히스토리 + 현재)
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10),  // 최근 10개 메시지만
      { role: 'user', content: userText },
    ]

    // 1. GPT로 텍스트 응답 생성
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 100,
        temperature: 0.8,
      }),
    })

    if (!chatResponse.ok) {
      console.error('[GPT Error]', await chatResponse.text())
      return NextResponse.json({ ok: true, message: getKeywordResponse(userText) })
    }

    const chatData = await chatResponse.json()
    const aiMessage = chatData.choices?.[0]?.message?.content?.trim() || getKeywordResponse(userText)

    // 2. OpenAI TTS로 음성 생성
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: aiMessage,
        voice: 'nova',  // 밝고 친근한 음성
        response_format: 'mp3',
        speed: 1.0,
      }),
    })

    if (!ttsResponse.ok) {
      console.error('[TTS Error]', await ttsResponse.text())
      // TTS 실패해도 텍스트는 반환
      return NextResponse.json({ ok: true, message: aiMessage })
    }

    // 3. Audio를 base64로 변환
    const audioBuffer = await ttsResponse.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    return NextResponse.json({ 
      ok: true, 
      message: aiMessage,
      audio: `data:audio/mp3;base64,${audioBase64}`
    })

  } catch (error: any) {
    console.error('[API Error]', error)
    return NextResponse.json({ ok: false, error: '다시 말해줄래?' }, { status: 500 })
  }
}

function getKeywordResponse(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('안녕')) return '안녕! 오늘 기분이 어때?'
  if (t.includes('누구')) return '나는 아이야! 네 친구야!'
  if (t.includes('심심')) return '심심해? 같이 놀까?'
  if (t.includes('노래')) return '반짝반짝 작은별~ 아름답게 비치네~'
  return '응! 더 말해줘!'
}
