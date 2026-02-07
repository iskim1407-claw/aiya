import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/notifications
 * 부모에게 알림 전송
 * 
 * 향후: OpenClaw Telegram 통합
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, message, childText, aiResponse, timestamp, telegramUserId } = body

    console.log('[Notification]', {
      type,
      message,
      childText,
      timestamp,
    })

    // 향후: OpenClaw로 Telegram 메시지 전송
    // await sendTelegramMessage(telegramUserId, message)

    return NextResponse.json({
      ok: true,
      sent: false, // 실제 전송은 아직 구현 안 됨
      type,
      message,
    })
  } catch (error) {
    console.error('[Notification Error]', error)
    return NextResponse.json(
      { ok: false, error: '알림 전송 실패' },
      { status: 500 }
    )
  }
}
