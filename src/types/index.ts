// 유저 타입
export interface User {
  id: string
  name: string
  role: 'child' | 'parent'
  parentId?: string // 부모 ID
  createdAt: Date
}

// 대화 기록
export interface ConversationMessage {
  id: string
  childId: string
  type: 'child' | 'ai'
  text: string
  audioUrl?: string
  timestamp: Date
}

// 부모 설정
export interface ParentSettings {
  id: string
  childId: string
  dailyLimitMinutes: number // 일일 사용 시간 제한
  allowedHours: {
    startTime: string // "09:00"
    endTime: string // "20:00"
  }
  blockedTopics: string[]
  enabledCategories: ('education' | 'play' | 'emotion' | 'habits')[]
  voicePreference: 'mom' | 'character' | 'narrator'
  enabled: boolean
}

// API 응답
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
