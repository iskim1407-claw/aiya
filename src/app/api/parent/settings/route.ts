import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import getDb from '@/lib/db'

/**
 * POST /api/parent/settings
 * 부모 설정 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const childId = body.childId || 'default-child'

    const db = getDb()
    const settingsId = uuidv4()

    await db.execute({
      sql: `INSERT OR REPLACE INTO parentSettings 
        (id, childId, dailyLimitMinutes, allowedStartTime, allowedEndTime, enabledCategories, voicePreference, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        settingsId,
        childId,
        body.dailyLimitMinutes || 60,
        body.allowedHours?.startTime || '09:00',
        body.allowedHours?.endTime || '20:00',
        (body.enabledCategories || ['education', 'play', 'emotion', 'habits']).join(','),
        body.voicePreference || 'mom',
        1
      ]
    })

    return NextResponse.json({ ok: true, settingsId })
  } catch (error) {
    console.error('Settings API 오류:', error)
    return NextResponse.json(
      { ok: false, error: '설정 저장 실패' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/parent/settings
 * 부모 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const childId = request.nextUrl.searchParams.get('childId') || 'default-child'
    const db = getDb()

    const result = await db.execute({
      sql: 'SELECT * FROM parentSettings WHERE childId = ?',
      args: [childId]
    })

    return NextResponse.json({
      ok: true,
      settings: result.rows[0] || null,
    })
  } catch (error) {
    console.error('Settings 조회 오류:', error)
    return NextResponse.json(
      { ok: false, error: '설정 조회 실패' },
      { status: 500 }
    )
  }
}
