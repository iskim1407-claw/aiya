# 아이야 (AiYa) - 유아용 한국어 음성 비서

2~4세 유아를 위한 안전한 음성 AI 비서. 모든 처리가 로컬 맥미니에서 이루어지며, 부모가 완벽하게 제어할 수 있습니다.

## 🚀 시작하기

### 설치

```bash
cd aiya
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인 가능합니다.

## 📁 프로젝트 구조

```
aiya/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # 메인 페이지
│   │   ├── child/        # 아이용 UI
│   │   ├── parent/       # 부모 대시보드
│   │   └── api/          # API 라우트
│   ├── components/       # React 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   │   └── db.ts         # SQLite 데이터베이스
│   ├── types/            # TypeScript 타입
│   └── styles/           # CSS
├── public/               # 정적 파일
└── package.json
```

## 🛠️ 기술 스택

- **프론트엔드**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **백엔드**: Next.js API Routes + Flask (STT)
- **데이터베이스**: SQLite (better-sqlite3)
- **음성 처리**:
  - STT: OpenAI Whisper (Flask 서버)
  - LLM: 키워드 기반 (향후 Ollama)
  - TTS: 준비 중 (Kokoro-82M)
- **실시간**: Socket.io (선택사항)
- **PWA**: next-pwa

## 📋 다음 단계 (TODO)

- [ ] STT 구현 (Whisper.cpp 연동)
- [ ] LLM 구현 (Ollama 연동)
- [ ] TTS 구현 (Kokoro-82M 또는 MeloTTS 연동)
- [ ] 부모 알림 (OpenClaw 연동)
- [ ] 단위 테스트 추가
- [ ] Docker 배포 설정

## 📝 라이선스

MIT
