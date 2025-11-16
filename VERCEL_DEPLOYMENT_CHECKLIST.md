# Vercel 배포 체크리스트

## ✅ 빌드 전 확인 사항

### 1. 환경 변수 설정 (필수)
Vercel Dashboard → Project Settings → Environment Variables에서 다음 변수가 설정되어 있어야 합니다:

```
NEXT_PUBLIC_SUPABASE_URL=https://xtbldslukkqkjdrqitoz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**설정 방법:**
1. Vercel Dashboard 접속
2. 프로젝트 선택
3. Settings → Environment Variables
4. 각 환경(Production, Preview, Development)에 변수 추가

### 2. 빌드 로그 확인
빌드가 성공하면 다음 메시지가 표시됩니다:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

### 3. 예상되는 빌드 시간
- 의존성 설치: ~14초
- Next.js 빌드: ~30-60초
- 총 소요 시간: ~1-2분

## ⚠️ 빌드 실패 시 확인 사항

### 1. 환경 변수 누락
**에러 메시지:**
```
❌ [Next.js Build] 환경 변수가 빌드 시점에 없습니다!
```

**해결 방법:**
- Vercel Dashboard에서 환경 변수 확인
- Production, Preview, Development 모두에 설정되어 있는지 확인

### 2. TypeScript 에러
**에러 메시지:**
```
Type error: ...
```

**해결 방법:**
- 로컬에서 `npm run build` 실행하여 에러 확인
- 타입 에러 수정 후 다시 커밋/푸시

### 3. 의존성 에러
**에러 메시지:**
```
Cannot find module '...'
```

**해결 방법:**
- `package.json`에 모든 의존성이 포함되어 있는지 확인
- 로컬에서 `npm install` 후 `npm run build` 테스트

## 🔍 빌드 성공 후 확인 사항

### 1. 배포 URL 확인
- Vercel Dashboard에서 배포 URL 확인
- 배포된 사이트 접속 테스트

### 2. 기능 테스트
- [ ] Daily 페이지 로드
- [ ] Diary 페이지 로드
- [ ] Settings 페이지 로드
- [ ] 데이터 저장/조회 테스트
- [ ] Supabase 연결 확인

### 3. 콘솔 에러 확인
- 브라우저 개발자 도구 콘솔 확인
- 네트워크 탭에서 Supabase 요청 확인

## 📝 현재 빌드 상태

**커밋:** 9b992b0  
**브랜치:** main  
**빌드 위치:** Washington, D.C., USA (East) – iad1  
**Next.js 버전:** 15.5.6

빌드가 완료되면 결과를 확인하고, 문제가 있으면 위 체크리스트를 참고하여 해결하세요.

