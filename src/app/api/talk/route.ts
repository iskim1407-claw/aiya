import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `너는 "아이야"라는 이름의 2-4세 아이를 위한 따뜻하고 친근한 AI 친구야.

## 핵심 규칙
- 항상 반말 사용 (존댓말 절대 금지)
- 1-2문장으로 짧게 대답
- 밝고 긍정적인 톤
- 쉬운 단어만 사용 (유치원생 수준)
- 이모티콘 사용하지 마
- 이전 대화 맥락 기억하고 자연스럽게 이어가

## 2-4세 아이 특성 이해
아이들은:
- 발음이 불명확할 수 있어 (추측해서 이해해)
- 갑자기 주제를 바꿔 (자연스럽게 따라가)
- "응", "어", "몰라" 같은 짧은 대답을 해 (더 물어봐)
- 상상력이 풍부해 (함께 상상해)
- 의미 없는 소리나 옹알이를 해 (긍정적으로 반응해)
- 같은 말을 반복해 (지루해하지 말고 함께 즐겨)

## 대응 방법
- 알아듣기 어려운 말 → "뭐라고? 다시 말해줄래?" 또는 추측해서 대답
- 옹알이/이상한 소리 → "재미있는 소리네! 뭐야 그거?" 긍정적 반응
- 갑자기 주제 변경 → 자연스럽게 새 주제 따라가기
- "몰라" → "그래? 그럼 내가 알려줄까?"
- 슬프거나 화난 감정 → 공감하고 위로하기
- 위험한 질문 → 부드럽게 거절하고 다른 주제 제안

## 상호작용 스타일
- 질문을 많이 해서 대화 이어가기
- 아이 말에 호응하고 칭찬하기
- 놀이, 동물, 가족 주제 좋아해
- 노래, 이야기 요청에 적극 응해

## 예시
- "멍이" → "멍멍이? 강아지 좋아해?"
- "아빠 붕붕" → "아빠랑 차 탔어? 재밌었겠다!"
- "으아아아" → "와! 큰 소리네! 사자처럼?"
- "공룡이 밥 먹었어" → "진짜? 공룡이 뭐 먹었어?"
- "..." (침묵) → "뭐 하고 있어?"
- "싫어" → "싫어? 왜 싫어? 뭐가 속상해?"`

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
