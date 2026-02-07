'use client'

import { useState, useEffect } from 'react'

interface Conversation {
  id: string
  childId: string
  type: 'child' | 'ai'
  text: string
  timestamp: string
}

interface ParentSettings {
  dailyLimitMinutes: number
  allowedStartTime: string
  allowedEndTime: string
}

export default function ParentPage() {
  const [settings, setSettings] = useState<ParentSettings>({
    dailyLimitMinutes: 60,
    allowedStartTime: '09:00',
    allowedEndTime: '20:00',
  })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    totalCount: 0,
    childCount: 0,
    aiCount: 0,
  })

  useEffect(() => {
    fetchSettings()
    fetchConversations()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/parent/settings?childId=default-child')
      const data = await response.json()
      if (data.ok && data.settings) {
        setSettings({
          dailyLimitMinutes: data.settings.dailyLimitMinutes,
          allowedStartTime: data.settings.allowedStartTime,
          allowedEndTime: data.settings.allowedEndTime,
        })
      }
    } catch (error) {
      console.error('설정 조회 오류:', error)
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/parent/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: 'default-child',
          dailyLimitMinutes: settings.dailyLimitMinutes,
          allowedHours: {
            startTime: settings.allowedStartTime,
            endTime: settings.allowedEndTime,
          },
        }),
      })
      const data = await response.json()
      if (data.ok) {
        alert('✅ 설정이 저장되었습니다.')
      }
    } catch (error) {
      console.error('저장 오류:', error)
      alert('❌ 저장 실패')
    } finally {
      setIsSaving(false)
    }
  }

  const fetchConversations = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/parent/conversations?childId=default-child&limit=50')
      const data = await response.json()
      if (data.ok) {
        setConversations(data.conversations || [])
        
        // 통계 계산
        const childCount = data.conversations.filter((c: Conversation) => c.type === 'child').length
        const aiCount = data.conversations.filter((c: Conversation) => c.type === 'ai').length
        
        setStats({
          totalCount: data.conversations.length,
          childCount,
          aiCount,
        })
      }
    } catch (error) {
      console.error('조회 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="admin-interface p-8">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👨‍👩‍👧 부모 대시보드</h1>
          <p className="text-gray-600">아이의 사용을 모니터링하고 설정하세요</p>
        </div>

        {/* 설정 섹션 */}
        <div className="admin-card mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">⏰ 사용 시간 설정</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                일일 사용 시간 제한 (분)
              </label>
              <input
                type="number"
                value={settings.dailyLimitMinutes}
                onChange={(e) => setSettings({
                  ...settings,
                  dailyLimitMinutes: parseInt(e.target.value) || 0,
                })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
              />
              <p className="mt-2 text-sm text-gray-500">
                현재: {settings.dailyLimitMinutes}분 (약 {Math.floor(settings.dailyLimitMinutes / 60)}시간 {settings.dailyLimitMinutes % 60}분)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용 가능 시작 시간
                </label>
                <input
                  type="time"
                  value={settings.allowedStartTime}
                  onChange={(e) => setSettings({
                    ...settings,
                    allowedStartTime: e.target.value,
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용 가능 종료 시간
                </label>
                <input
                  type="time"
                  value={settings.allowedEndTime}
                  onChange={(e) => setSettings({
                    ...settings,
                    allowedEndTime: e.target.value,
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isSaving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </div>

        {/* 통계 섹션 */}
        {conversations.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="admin-card text-center">
              <p className="text-gray-600 text-sm">총 대화</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalCount}</p>
            </div>
            <div className="admin-card text-center">
              <p className="text-gray-600 text-sm">아이의 말</p>
              <p className="text-3xl font-bold text-green-600">{stats.childCount}</p>
            </div>
            <div className="admin-card text-center">
              <p className="text-gray-600 text-sm">아이야의 응답</p>
              <p className="text-3xl font-bold text-purple-600">{stats.aiCount}</p>
            </div>
          </div>
        )}

        {/* 대화 기록 섹션 */}
        <div className="admin-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">💬 대화 기록</h2>
            <button
              onClick={fetchConversations}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isLoading ? '로딩 중...' : '새로고침'}
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">아직 대화 기록이 없습니다.</p>
              <p className="text-gray-500 text-sm mt-2">아이가 말을 시작하면 여기에 나타납니다.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {conversations.map((conv) => (
                <div key={conv.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <p className="text-xs text-gray-400 mb-2">
                    {new Date(conv.timestamp).toLocaleString('ko-KR')}
                  </p>
                  <p className={`text-sm font-semibold ${
                    conv.type === 'child' 
                      ? 'text-blue-600' 
                      : 'text-purple-600'
                  }`}>
                    {conv.type === 'child' ? '👧 아이' : '🤖 아이야'}
                  </p>
                  <p className="text-gray-800 mt-1 leading-relaxed">
                    {conv.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
