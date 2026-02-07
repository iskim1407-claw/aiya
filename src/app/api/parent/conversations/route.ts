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

    const conversations = db.prepare(`
      SELECT id, childId, type, text, audioUrl, timestamp
      FROM conversations
      WHERE childId = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(childId, limit, offset) as any[]

    // timestamp를 ISO 형식으로 변환
    const formatted = conversations.map(c => ({
      ...c,
      timestamp: c.timestamp,
    }))

    return NextResponse.json({
      ok: true,
      conversations: formatted,
      total: conversations.length,
    })
  } catch (error) {
    console.error('Conversations 조회 오류:', error)
    return NextResponse.json(
      { ok: false, error: '대화 기록 조회 실패' },
      { status: 500 }
    )
  }
}
