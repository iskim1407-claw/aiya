/**
 * OpenClaw 알림 연동
 * 부모에게 중요한 이벤트 알리기
 */

export interface NotificationEvent {
  type: 'long_conversation' | 'special_keyword' | 'limit_warning'
  message: string
  timestamp: Date
  childText: string
  aiResponse: string
}

/**
 * OpenClaw로 알림 전송 (Telegram)
 * 나중에 구현: OpenClaw cron job으로 통합
 */
export async function sendNotification(event: NotificationEvent, telegramUserId?: string) {
  try {
    // 로컬 API (향후 OpenClaw 게이트웨이로 전환)
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: event.type,
        message: event.message,
        childText: event.childText,
        aiResponse: event.aiResponse,
        timestamp: event.timestamp.toISOString(),
        telegramUserId,
      }),
    })

    if (!response.ok) {
      console.error('[Notification Error]', response.status)
    }
  } catch (error) {
    console.error('[Notification Failed]', error)
  }
}

/**
 * 대화 분석 - 알림할 이벤트 감지
 */
export function analyzeConversation(
  childText: string,
  aiResponse: string,
  conversationCount: number
): NotificationEvent | null {
  // 1. 특정 키워드 감지 (위험한 내용 등)
  const dangerousKeywords = ['나쁜', '싫', '울', '때리']
  if (dangerousKeywords.some(kw => childText.includes(kw))) {
    return {
      type: 'special_keyword',
      message: `⚠️ 아이가 "${childText}"라고 말했습니다.`,
      childText,
      aiResponse,
      timestamp: new Date(),
    }
  }

  // 2. 장시간 사용 경고 (20회 이상)
  if (conversationCount > 20) {
    return {
      type: 'limit_warning',
      message: `📊 아이가 벌써 ${conversationCount}번 말했습니다. 휴식이 필요할 수 있습니다.`,
      childText,
      aiResponse,
      timestamp: new Date(),
    }
  }

  return null
}
