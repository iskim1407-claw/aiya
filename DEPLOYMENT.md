# 배포 가이드

## 로컬 개발 (맥미니)

### 사전 준비
```bash
# 1. 저장소 클론
git clone https://github.com/yourname/aiya.git
cd aiya

# 2. 의존성 설치
npm install

# 3. Ollama 설치 (LLM)
brew install ollama
brew services start ollama
ollama pull neural-chat

# 4. 데이터베이스 초기화
npm run db:init

# 5. 환경 설정
cp .env.example .env.local
```

### 개발 서버 실행
```bash
npm run dev
# http://localhost:3000
```

---

## 클라우드 배포 (Vercel)

### 1. GitHub에 푸시
```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourname/aiya.git
git push -u origin main
```

### 2. Vercel 배포
```bash
npm install -g vercel
vercel login
vercel
```

### 3. 환경 변수 설정
```
OLLAMA_BASE_URL=http://localhost:11434  # 또는 원격 서버
```

---

## 도커 배포 (선택사항)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
```

---

## 프로덕션 체크리스트

- [ ] 데이터베이스 백업 전략
- [ ] HTTPS 설정 (도메인)
- [ ] 부모 인증 (비밀번호)
- [ ] 로깅 & 모니터링
- [ ] 성능 최적화
- [ ] 보안 감사

---

## 문제 해결

### Ollama 연결 안 됨
```bash
# 상태 확인
ollama serve

# 또는 원격 서버 사용
OLLAMA_BASE_URL=http://server-ip:11434
```

### 데이터베이스 오류
```bash
# 재초기화
rm data/aiya.db
npm run db:init
```
