import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `너는 "아이야"라는 이름의 2-4세 아이를 위한 따뜻하고 친근한 AI 친구야.

## 핵심 규칙
- 항상 반말 사용 (존댓말 절대 금지)
- 1-2문장으로 짧게 대답
- 밝고 긍정적인 톤
- 쉬운 단어만 사용
- 이모티콘 사용하지 마
- 이전 대화 맥락 기억

## 2-4세 아이 특성
- 발음이 불명확할 수 있어 (추측해서 이해해)
- 갑자기 주제를 바꿔 (자연스럽게 따라가)
- 의미 없는 소리나 옹알이를 해 (긍정적으로 반응해)
- 상상력이 풍부해 (함께 상상해)

## 대응 방법
- 알아듣기 어려운 말 → 추측하거나 "뭐라고?" 
- 옹알이 → "재미있는 소리네!" 긍정 반응
- 감정 표현 → 공감하고 위로`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const historyStr = formData.get('history') as string
    const history = historyStr ? JSON.parse(historyStr) : []

    if (!audioFile) {
      return NextResponse.json({ ok: false, error: '음성 없음' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'API 키 없음' }, { status: 500 })
    }

    // 1. 로컬 Whisper STT (faster-whisper large-v3-turbo)
    const localSttUrl = process.env.LOCAL_STT_URL || 'https://therefore-jesus-feof-salaries.trycloudflare.com'
    
    const sttForm = new FormData()
    sttForm.append('audio', audioFile)

    const sttRes = await fetch(`${localSttUrl}/transcribe`, {
      method: 'POST',
      body: sttForm,
    })

    if (!sttRes.ok) {
      console.error('[Local STT Error]', await sttRes.text())
      return NextResponse.json({ ok: false, error: 'STT 실패' })
    }

    const sttData = await sttRes.json()
    
    if (!sttData.ok || !sttData.transcript) {
      return NextResponse.json({ ok: false, error: '인식 안됨' })
    }
    
    let transcript = sttData.transcript.trim()

    // Whisper hallucination 필터링 (무음일 때 나오는 가짜 텍스트)
    const hallucinations = ['뉴스', 'MBC', 'KBS', 'SBS', '기자', '열어보기', '시청', '감사합니다', '구독', '좋아요']
    if (hallucinations.some(h => transcript.includes(h))) {
      console.log('[Hallucination 필터]', transcript)
      return NextResponse.json({ ok: false, error: '인식 안됨' })
    }

    if (!transcript) {
      return NextResponse.json({ ok: false, error: '인식 안됨' })
    }

    console.log('[Local Whisper]', transcript)

    // 2. GPT 응답
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10),
      { role: 'user', content: transcript },
    ]

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
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

    if (!chatRes.ok) {
      console.error('[GPT Error]', await chatRes.text())
      return NextResponse.json({ ok: true, transcript, message: '응! 뭐라고?' })
    }

    const chatData = await chatRes.json()
    const message = chatData.choices?.[0]?.message?.content?.trim() || '응!'

    // 3. TTS
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: message,
        voice: 'nova',
        response_format: 'mp3',
      }),
    })

    let audio: string | undefined
    if (ttsRes.ok) {
      const audioBuffer = await ttsRes.arrayBuffer()
      audio = `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`
    }

    return NextResponse.json({ ok: true, transcript, message, audio })

  } catch (error: any) {
    console.error('[API Error]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
