# 마크다운 에디터 적용 가이드

## 1단계: src/app/memo/page.tsx 에디터 영역 교체

### 현재 에디터 찾기
1. `src/app/memo/page.tsx` 파일 열기
2. `{/* 에디터 */}` 주석 찾기 (약 line 715)
3. 해당 위치부터 `{/* 메모 목록 */}` 주석 전까지 전체 선택

### 새 코드로 교체
1. `NEW_EDITOR_CODE.tsx` 파일 열기
2. 전체 내용 복사
3. 선택한 기존 에디터 코드에 붙여넣기

---

## 2단계: 목록에서 마크다운 렌더링 추가

### renderMemoCard 함수 수정

**찾기**: `const renderMemoCard` 함수 (약 line 500-600)

**변경 전**:
```tsx
// 미리보기 텍스트 (HTML에서 추출)
const previewText = extractText(memo.content).substring(0, 150);
```

**변경 후**:
```tsx
// HTML/마크다운 판별 및 미리보기 생성
const isHtml = memo.content.startsWith('<');
let previewText = '';

if (isHtml) {
  // 기존 HTML 글: HTML에서 텍스트 추출
  previewText = extractText(memo.content).substring(0, 150);
} else {
  // 새 마크다운 글: 마크다운 기호 제거하고 텍스트만
  previewText = memo.content
    .replace(/[#*`>\-\[\]]/g, '')  // 마크다운 기호 제거
    .replace(/!\[.*?\]\(.*?\)/g, '[이미지]')  // 이미지 링크 → [이미지]
    .trim()
    .substring(0, 150);
}
```

---

## 3단계: 상세 페이지 수정 (선택사항)

**파일**: `src/app/memo/[id]/page.tsx`

이 파일도 마찬가지로 수정해야 합니다:
1. 에디터를 textarea + react-markdown으로 변경
2. 렌더링 시 HTML/마크다운 판별

**렌더링 부분 예시**:
```tsx
{/* 기존 코드 */}
<div dangerouslySetInnerHTML={{ __html: memo.content }} />

{/* 변경 후 */}
{memo.content.startsWith('<') ? (
  // 기존 HTML 글
  <div dangerouslySetInnerHTML={{ __html: memo.content }} />
) : (
  // 새 마크다운 글
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {memo.content}
  </ReactMarkdown>
)}
```

---

## 4단계: Tailwind prose 스타일 추가

**파일**: `tailwind.config.ts` (또는 `tailwind.config.js`)

```js
module.exports = {
  // ... 기존 설정
  plugins: [
    require('@tailwindcss/typography'),  // 이미 있으면 추가 안 해도 됨
  ],
}
```

만약 `@tailwindcss/typography`가 없으면:
```bash
npm install @tailwindcss/typography
```

---

## 5단계: 테스트

1. **저장 테스트**
   - 새 글 작성 → 마크다운 입력 → 저장
   - content 컬럼에 마크다운 텍스트로 저장되는지 확인

2. **렌더링 테스트**
   - 목록에서 미리보기 정상 표시
   - 상세 페이지에서 마크다운 렌더링 확인

3. **기존 글 호환성**
   - HTML로 저장된 기존 글도 정상 표시되는지 확인

4. **모바일 테스트**
   - 툴바 버튼 탭 동작 확인
   - 마크다운 입력 확인

---

## 완료!

모든 단계를 완료하면 모바일에서도 완벽하게 작동하는 마크다운 에디터가 완성됩니다!
