import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

/**
 * GET /api/parent/conversations
 * 대화 기록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const childId = request.nextUrl.searchParams.get('childId') || 'default-child'
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10)

    const db = getDb()

    const result = await db.execute({
      sql: `SELECT id, childId, type, text, audioUrl, timestamp
        FROM conversations
        WHERE childId = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?`,
      args: [childId, limit, offset]
    })

    return NextResponse.json({
      ok: true,
      conversations: result.rows,
      total: result.rows.length,
    })
  } catch (error) {
    console.error('Conversations 조회 오류:', error)
    return NextResponse.json(
      { ok: false, error: '대화 기록 조회 실패' },
      { status: 500 }
    )
  }
}
