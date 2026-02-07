# Vercel 배포 가이드 (상세)

## 방법 1: GitHub 연동 (추천)

### 1단계: GitHub 저장소 생성

1. https://github.com/new 접속
2. Repository name: `aiya`
3. Public 선택
4. Create repository 클릭

### 2단계: 로컬에서 푸시

```bash
cd /Users/jarvis/.openclaw/workspace/aiya

# Git 설정 (이미 완료)
git config user.email "iskim1407@gmail.com"
git config user.name "Joseph Kim"

# 원격 저장소 추가 (yourname을 GitHub username으로 변경)
git remote add origin https://github.com/yourname/aiya.git
git branch -M main
git push -u origin main
```

### 3단계: Vercel에서 배포

1. https://vercel.com 접속
2. Sign up with GitHub
   - GitHub 인증 진행
   - iskim1407@gmail.com 연결

3. "New Project" 클릭
4. "Import Git Repository"
5. `aiya` 선택
6. Deploy 클릭

---

## 방법 2: Vercel CLI (빠른 배포)

### 1단계: Vercel 로그인

```bash
npm install -g vercel
vercel login

# 이메일 선택: iskim1407@gmail.com
# 인증 링크 클릭
```

### 2단계: 배포

```bash
cd /Users/jarvis/.openclaw/workspace/aiya
vercel
```

---

## 환경 변수 설정

배포 후 Vercel 대시보드에서:

1. Project Settings → Environment Variables
2. 다음 추가:

```
OLLAMA_BASE_URL=http://localhost:11434
NODE_ENV=production
```

> ⚠️ 주의: Ollama는 로컬 서버이므로, Vercel에서는 동작 안 함
> 해결책: Ollama를 Docker로 원격 배포하거나, Hugging Face 모델 사용

---

## 로컬 테스트 후 배포

```bash
npm run build
npm run start

# http://localhost:3000 확인
```

---

## 문제 해결

### "Cannot find module" 오류
```bash
npm install
npm run build
```

### Ollama 연결 안 됨
- Vercel은 클라우드 서버이므로 로컬 Ollama 접근 불가
- 해결책: 원격 Ollama 서버 설정

### 배포 롤백
```bash
vercel rollback
```

---

## 다음 단계

1. ✅ GitHub에 코드 푸시
2. ✅ Vercel로 배포
3. 🔄 도메인 설정 (선택사항)
4. 🔄 CI/CD 파이프라인 (선택사항)

---

**배포 완료 후 URL: `https://aiya.vercel.app`**
