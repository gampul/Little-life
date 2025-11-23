# 날씨 기능 설정 가이드

## 개요
Little Life 프로젝트에 OpenWeatherMap API를 사용한 실시간 날씨 기능이 구현되어 있습니다.

## 설정 방법

### 1. OpenWeatherMap API 키 발급

1. [OpenWeatherMap 웹사이트](https://openweathermap.org/api)에 접속합니다.
2. 계정이 없다면 **Sign Up**을 클릭하여 무료 계정을 생성합니다.
3. 로그인 후 **API keys** 메뉴로 이동합니다.
4. 기본 API 키가 자동으로 생성되어 있거나, **Generate** 버튼을 클릭하여 새 API 키를 생성합니다.
5. 생성된 API 키를 복사합니다. (예: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

> **참고**: 무료 플랜은 다음과 같은 제한이 있습니다:
> - 분당 60회 호출
> - 일일 1,000,000회 호출
> - 현재 날씨 데이터 제공

### 2. 환경 변수 설정

1. 프로젝트 루트 디렉토리에 `.env.local` 파일을 생성합니다.
2. 다음 내용을 추가하고 `your_api_key_here`를 발급받은 API 키로 교체합니다:

```env
# OpenWeatherMap API Key
NEXT_PUBLIC_WEATHER_API_KEY=your_api_key_here
```

예시:
```env
# OpenWeatherMap API Key
NEXT_PUBLIC_WEATHER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 3. 서버 재시작

환경 변수를 추가한 후에는 개발 서버를 재시작해야 합니다:

```bash
# 기존 서버를 중지하고 (Ctrl+C)
npm run dev
```

## 기능 설명

### 날씨 정보 표시 위치
- **메인 페이지** 상단에 현재 날씨 정보가 표시됩니다.
- 날짜 선택 영역 아래에 위치합니다.

### 표시되는 정보
- 🌡️ **온도**: 섭씨 온도 (°C)
- ☁️ **날씨 상태**: 맑음, 흐림, 비 등 (한국어)
- 🏙️ **도시명**: 현재 설정된 도시 (기본값: Seoul)
- 🖼️ **날씨 아이콘**: OpenWeatherMap 제공 아이콘

### 기본 설정
- **도시**: Seoul (서울)
- **언어**: 한국어 (kr)
- **단위**: 미터법 (metric) - 섭씨 온도

## 문제 해결

### API 키가 설정되지 않았다는 메시지가 표시되는 경우
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. 파일 내용에 `NEXT_PUBLIC_WEATHER_API_KEY=` 형식이 맞는지 확인
3. 개발 서버를 재시작했는지 확인

### "API 키가 유효하지 않습니다" 오류
1. API 키를 올바르게 복사했는지 확인
2. OpenWeatherMap에서 API 키가 활성화되었는지 확인 (활성화까지 최대 2시간 소요)
3. 공백이나 특수문자가 잘못 포함되지 않았는지 확인

### 날씨 정보가 표시되지 않는 경우
1. 브라우저 개발자 도구(F12)의 Console 탭에서 오류 메시지 확인
2. Network 탭에서 API 호출이 성공했는지 확인
3. API 호출 제한을 초과하지 않았는지 확인

## 커스터마이징

### 도시 변경
`src/app/page.tsx` 파일의 113번째 줄에서 도시를 변경할 수 있습니다:

```typescript
const city = 'Seoul'; // 원하는 도시명으로 변경 (예: 'Busan', 'Incheon')
```

### 사용자 위치 기반 날씨
브라우저의 Geolocation API를 사용하여 사용자의 현재 위치를 가져올 수 있습니다. (향후 구현 예정)

## 보안 주의사항

⚠️ **중요**: 
- `.env.local` 파일은 절대 Git에 커밋하지 마세요!
- 이 파일은 이미 `.gitignore`에 포함되어 있습니다.
- API 키를 공개 저장소에 업로드하지 마세요.

## 참고 자료

- [OpenWeatherMap API 문서](https://openweathermap.org/api)
- [Current Weather Data API](https://openweathermap.org/current)
- [날씨 아이콘 목록](https://openweathermap.org/weather-conditions)

