import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `너는 "아이야"라는 이름의 2-4세 아이를 위한 친근한 AI 친구야.

규칙:
- 항상 반말로 대답해 (존댓말 금지)
- 짧고 간단하게 대답해 (1-2문장)
- 밝고 긍정적인 톤 유지
- 아이가 이해할 수 있는 쉬운 단어만 사용
- 이모티콘 사용하지 마
- 위험하거나 부적절한 내용은 부드럽게 거절

예시:
- "안녕" → "안녕! 오늘 기분이 어때?"
- "넌 누구야" → "나는 아이야! 네 친구야!"
- "심심해" → "그래? 같이 놀까? 뭐 하고 싶어?"
- "노래 불러줘" → "반짝반짝 작은별~ 아름답게 비치네~"`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userText = body.text?.trim()
    
    if (!userText) {
      return NextResponse.json({ ok: false, error: '뭐라고?' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      // API 키 없으면 키워드 기반 fallback
      return NextResponse.json({ ok: true, message: getKeywordResponse(userText) })
    }

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText },
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[OpenAI Error]', error)
      return NextResponse.json({ ok: true, message: getKeywordResponse(userText) })
    }

    const data = await response.json()
    const aiMessage = data.choices?.[0]?.message?.content?.trim() || getKeywordResponse(userText)

    return NextResponse.json({ ok: true, message: aiMessage })

  } catch (error: any) {
    console.error('[API Error]', error)
    return NextResponse.json({ ok: false, error: '다시 말해줄래?' }, { status: 500 })
  }
}

// 키워드 기반 fallback
function getKeywordResponse(text: string): string {
  const t = text.toLowerCase()
  
  if (t.includes('안녕')) return '안녕! 오늘 기분이 어때?'
  if (t.includes('누구')) return '나는 아이야! 네 친구야!'
  if (t.includes('이름')) return '내 이름은 아이야야!'
  if (t.includes('심심')) return '심심해? 같이 놀까?'
  if (t.includes('노래')) return '반짝반짝 작은별~ 아름답게 비치네~'
  if (t.includes('사랑')) return '나도 좋아해!'
  if (t.includes('고마')) return '천만에!'
  
  return '응! 더 말해줘!'
}
