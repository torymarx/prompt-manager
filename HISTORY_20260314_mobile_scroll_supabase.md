# Prompt-Manager 수정 히스토리 (2026-03-14)

## 작업 내용

### 1. 모바일 터치 스크롤 수정 🐛→✅
**문제**: 긴 프롬프트 내용을 모바일에서 볼 때 스크롤이 안 됨 (마우스 없는 환경)

**수정 파일**:
- `components/prompts/PromptCard.tsx` — ContentModal에 `touch-action`, `overscroll-behavior` 인라인 스타일 추가
- `app/globals.css` — `.overflow-y-auto` 및 모달 내부 스크롤 영역에 모바일 터치 스크롤 CSS 추가

**적용 기술**:
- `touch-action: pan-y` → 수직 터치 스크롤 명시 허용
- `overscroll-behavior: contain` → 모달 내 스크롤이 배경으로 전파되지 않도록 차단
- `-webkit-overflow-scrolling: touch` → iOS 관성 스크롤 활성화

### 2. Supabase 잠김 방지 강화 🔒→✅
**문제**: Free tier 7일 비활동 시 프로젝트 일시 중단(Pause) 위험

**수정 파일**:
- `vercel.json` — cron 스케줄: `0 0 * * *` (1일 1회) → `0 */4 * * *` (4시간마다, 하루 6회)
- `app/api/health/route.ts` — 응답에 `schedule`, `interval` 필드 추가

## 빌드 검증
- ✅ `npm run build` 성공 (Next.js 16.1.6 Turbopack, exit code: 0)

---

## 2차 수정 (20:30)

### 제일 작은 사이즈 스크롤 안 되는 문제 근본 원인 수정

**근본 원인**: 모바일 브라우저에서 `100vh`는 주소창 높이를 포함하여 실제 화면보다 큼 → 하단이 잘려 스크롤 영역이 0이 됨

**수정 파일**:
- `app/dashboard/DashboardClient.tsx` — `h-screen` (100vh) → `h-dvh` (100dvh, 동적 뷰포트 높이)
- `components/prompts/PromptCard.tsx` — ContentModal:
  - `max-h-[90vh]` → `max-h-[90dvh]` (모달 높이도 동적 뷰포트 기준)
  - `overflow-hidden` 제거 (내부 flex 자식 스크롤 차단 해제)
  - `min-h-0` 추가 (flex 자식이 부모보다 작아질 수 있도록 허용)

**빌드 검증**: ✅ `npm run build` 성공 (exit code: 0)
