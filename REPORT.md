# 프롬프트 매니저 — 개발 과정 상세 보고서

**프로젝트명:** 프롬프트 매니저 (Prompt Manager)
**개발사:** Naku Lab Studio
**연락처:** naku.lab.studio@kakao.com
**배포 URL:** https://prompt-manager-three-coral.vercel.app
**작성일:** 2026년 3월

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [개발 단계별 구현 과정](#5-개발-단계별-구현-과정)
6. [주요 기술 도전과 해결 방안](#6-주요-기술-도전과-해결-방안)
7. [보안 점검 및 개선](#7-보안-점검-및-개선)
8. [배포 과정](#8-배포-과정)
9. [최종 파일 구조](#9-최종-파일-구조)
10. [기능 요약](#10-기능-요약)

---

## 1. 프로젝트 개요

### 배경 및 목적

AI 활용이 일상화되면서 ChatGPT, Claude 등의 LLM에 입력하는 프롬프트가 빠르게 축적됩니다. 그러나 메모장, 노션 등 범용 도구로 관리하면 검색·분류·공유가 불편합니다. **프롬프트 매니저**는 이 문제를 해결하기 위해 설계된 전용 SaaS 도구입니다.

### 핵심 요구사항

- 폴더 트리 기반 프롬프트 분류
- 해시태그·키워드 검색
- 마크다운 에디터로 서식 있는 프롬프트 작성
- 웹사이트 북마크 관리 (프롬프트와 별도 폴더)
- 개별 프롬프트 공유 / 전체 컬렉션 2일 만료 공유
- 다크모드 지원
- 비로그인 공개 공유 페이지

---

## 2. 기술 스택

| 분류 | 기술 | 선택 이유 |
|------|------|-----------|
| **프레임워크** | Next.js 16 (App Router) | 서버/클라이언트 컴포넌트 분리, SSR/SSG 혼용 |
| **언어** | TypeScript 5 | 타입 안전성, 자동완성, 리팩터링 용이 |
| **스타일링** | Tailwind CSS v4 | 유틸리티 클래스, 빠른 UI 개발 |
| **UI 컴포넌트** | shadcn/ui + Radix UI | 접근성(a11y) 준수, 커스터마이징 용이 |
| **백엔드/DB** | Supabase | PostgreSQL + Auth + Storage + Realtime 통합 |
| **AI** | Anthropic Claude (Haiku) | 핵심 키워드 자동 추출 |
| **썸네일** | Microlink API | URL에서 스크린샷·메타데이터 추출 |
| **배포** | Vercel | Next.js 최적화, Edge Middleware 지원 |
| **상태관리** | React Hooks (커스텀 훅) | 외부 라이브러리 없이 Supabase 실시간 동기화 |

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                     클라이언트 (브라우저)                   │
│  DashboardClient.tsx (Client Component)                   │
│  ├── Sidebar (폴더 트리)                                  │
│  ├── PromptList / WebsiteList (프롬프트/북마크 목록)        │
│  └── SearchBar, ThemeToggle, CollectionShareButton        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  Next.js 서버 (Vercel Edge)               │
│  middleware.ts    → 인증 체크, 라우팅 보호                 │
│  app/api/         → REST API (인증 필요)                  │
│  app/share/       → 공개 공유 페이지 (SSR)                 │
│  app/collection/  → 컬렉션 공유 페이지 (SSR)               │
└──────────────────────┬──────────────────────────────────┘
                       │ PostgreSQL / Storage API
┌──────────────────────▼──────────────────────────────────┐
│                      Supabase                            │
│  Auth     → 이메일 인증, 세션 관리                         │
│  Database → folders, prompts, collection_shares 테이블   │
│  Storage  → thumbnails 버킷 (이미지 업로드)                │
│  Realtime → prompts 테이블 실시간 동기화                   │
└─────────────────────────────────────────────────────────┘
```

### 컴포넌트 의존 관계

```
DashboardClient
├── Sidebar
│   ├── FolderTree
│   │   └── FolderNode (재귀)
│   └── HelpModal
├── PromptList
│   ├── PromptCard
│   └── PromptEditor
├── WebsiteList
│   ├── WebsiteCard
│   └── WebsiteEditor
├── SearchBar
├── CollectionShareButton
└── ThemeToggle
```

---

## 4. 데이터베이스 설계

### 테이블 구조

#### folders

```sql
CREATE TABLE public.folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,    -- 수동 정렬 (추후 추가)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**설계 포인트:**
- `parent_id` 자기 참조로 무한 중첩 폴더 트리 구현
- `ON DELETE CASCADE` — 부모 폴더 삭제 시 하위 폴더 자동 삭제
- `folder_type` (프롬프트/웹사이트) — DB 컬럼 대신 Supabase Auth `user_metadata`에 저장하여 PostgREST 스키마 캐시 충돌 회피

#### prompts

```sql
CREATE TABLE public.prompts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id    UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  image_url    TEXT,
  link_url     TEXT,                         -- 참조 링크 (추후 추가)
  sort_order   INTEGER NOT NULL DEFAULT 0,   -- 수동 정렬 (추후 추가)
  is_public    BOOLEAN NOT NULL DEFAULT false,
  share_token  UUID UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**설계 포인트:**
- `folder_id ON DELETE SET NULL` — 폴더 삭제 시 프롬프트를 '미분류'(null)로 이동
- `tags TEXT[]` — PostgreSQL 배열 타입, GIN 인덱스로 검색 최적화
- `share_token UUID UNIQUE` — 예측 불가능한 공유 토큰

#### collection_shares

```sql
CREATE TABLE public.collection_shares (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**설계 포인트:**
- `token` — `gen_random_bytes(16)` 16바이트 랜덤 hex 문자열
- `expires_at` — 생성 시점 기준 2일 후 자동 만료

### RLS (Row Level Security) 정책

모든 테이블에 RLS 활성화. 핵심 정책:

| 테이블 | 정책 | 조건 |
|--------|------|------|
| folders | SELECT/INSERT/UPDATE/DELETE | `user_id = auth.uid()` |
| prompts | SELECT (본인) | `user_id = auth.uid()` |
| prompts | SELECT (공개) | `is_public = true AND share_token IS NOT NULL` |
| prompts | SELECT (컬렉션) | `EXISTS (유효한 collection_shares)` |
| collection_shares | ALL (본인) | `user_id = auth.uid()` |
| collection_shares | SELECT (공개) | `expires_at > now()` |

### 인덱스 (7개)

```sql
idx_folders_user_id      -- 사용자별 폴더 조회
idx_folders_parent_id    -- 부모 기준 하위 폴더 조회
idx_prompts_user_id      -- 사용자별 프롬프트 조회
idx_prompts_folder_id    -- 폴더별 프롬프트 조회
idx_prompts_share_token  -- 공유 토큰 조회 (PARTIAL)
idx_prompts_is_public    -- 공개 프롬프트 조회 (PARTIAL)
idx_prompts_tags         -- GIN 인덱스 (배열 검색)
```

---

## 5. 개발 단계별 구현 과정

### Phase 1 — 프로젝트 초기 설정

**목표:** Next.js + Supabase 연동 기반 구축

- Next.js 16 App Router 프로젝트 생성
- Tailwind CSS v4 + shadcn/ui 설치 및 설정
- Supabase 프로젝트 생성, `schema.sql` 작성 및 실행
- Supabase 클라이언트 분리: `lib/supabase/client.ts` (브라우저), `lib/supabase/server.ts` (SSR)
- `.env.local` 환경 변수 설정 (URL, Anon Key)
- Vercel 프로젝트 연결, 환경 변수 등록 후 초기 배포

---

### Phase 2 — 인증 시스템

**목표:** 이메일/비밀번호 회원가입·로그인·세션 관리

**구현 파일:** `components/auth/AuthForm.tsx`, `app/auth/callback/route.ts`, `middleware.ts`

**구현 내용:**
- 로그인/회원가입 통합 폼 (`AuthForm.tsx`)
- Supabase Auth 이메일 인증 플로우 구현
- `auth/callback/route.ts` — 이메일 인증 링크 클릭 후 세션 교환 처리
- `middleware.ts` — 모든 요청에서 세션 갱신, `/dashboard` 미인증 접근 차단

**초기 버그:**
```
// proxy.ts (잘못된 설정 - 미들웨어 미작동)
export async function proxy(request: NextRequest) { ... }

// 수정: middleware.ts
export default async function middleware(request: NextRequest) { ... }
```
Next.js는 반드시 `middleware.ts` 파일명 + `export default` 방식이어야 인식됩니다. `proxy.ts + export function proxy` 조합으로 잘못 설정되어 인증 보호가 동작하지 않던 문제를 보안 점검 과정에서 발견·수정했습니다.

---

### Phase 3 — 폴더 트리

**목표:** 무한 중첩 폴더 CRUD + 트리 UI

**구현 파일:** `lib/hooks/useFolders.ts`, `components/folders/FolderTree.tsx`, `components/folders/FolderNode.tsx`

**핵심 로직 — 평탄한 배열 → 트리 변환:**

```typescript
export function buildFolderTree(folders: Folder[]): Folder[] {
  const map = new Map<string, Folder>()
  const roots: Folder[] = []
  folders.forEach((f) => map.set(f.id, { ...f, children: [] }))
  folders.forEach((f) => {
    const node = map.get(f.id)!
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}
```

**folder_type 저장 문제 해결:**

`folder_type` (프롬프트/웹사이트) 컬럼을 DB에 추가하면 PostgREST 스키마 캐시 갱신이 필요해 배포 직후 오류가 발생했습니다. 이를 우회하기 위해 **Supabase Auth의 `user_metadata`** 에 웹사이트 폴더 ID 목록을 저장하는 방식으로 설계:

```typescript
// user_metadata에 website_folder_ids 배열로 관리
async function loadWebsiteIds(supabase): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser()
  const ids = (user?.user_metadata?.website_folder_ids ?? []) as string[]
  return new Set(ids)
}
```

**폴더 순서 정렬:**

초기에는 이름 순 정렬이었으나, 사용자 요청으로 `sort_order` 수동 정렬 기능 추가:

```sql
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
```

FolderNode 드롭다운 메뉴에 "위로 이동 / 아래로 이동" 추가, `reorderFolders` 함수로 형제 노드 배열을 인덱스 순서대로 일괄 업데이트.

---

### Phase 4 — 프롬프트 CRUD

**목표:** 마크다운 에디터, 태그, 이미지, 공유 기능

**구현 파일:** `lib/hooks/usePrompts.ts`, `components/prompts/PromptEditor.tsx`, `components/prompts/PromptCard.tsx`, `components/prompts/PromptList.tsx`

#### 4-1. 마크다운 에디터

서식 툴바(굵게/기울임/코드/제목/목록) + `react-markdown` + `remark-gfm` 조합:

```typescript
const insertMarkdown = useCallback((prefix: string, suffix: string, placeholder: string) => {
  const textarea = textareaRef.current
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = form.content.slice(start, end) || placeholder
  const newContent =
    form.content.slice(0, start) + prefix + selected + suffix + form.content.slice(end)
  setForm((p) => ({ ...p, content: newContent }))
}, [form.content])
```

초기에는 편집/분할/미리보기 3단계 뷰 전환을 제공했으나, 사용자 요청으로 **편집 모드만 유지**하여 UI를 단순화했습니다.

#### 4-2. 해시태그 자동 추출

내용에서 `#태그` 형식을 감지하여 태그 추가를 자동 제안:

```typescript
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([^\s#,]+)/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
}
```

#### 4-3. AI 핵심 키워드 추출

프롬프트 내용 입력 후 디바운스(1초) → Anthropic Claude Haiku API 호출 → 핵심 한국어 단어 1개 자동 제안:

```typescript
// app/api/extract-keyword/route.ts
const message = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 20,
  messages: [{
    role: 'user',
    content: `다음 프롬프트의 핵심 주제를 나타내는 한국어 단어를 정확히 하나만 답하세요...`
  }]
})
```

#### 4-4. 이미지 업로드

Canvas API로 클라이언트에서 JPEG 압축 후 Supabase Storage `thumbnails` 버킷에 업로드:

```typescript
async function compressImage(file: File, maxPx = 1200, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // 비율 유지하며 maxPx 이하로 축소
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality)
    }
    img.src = URL.createObjectURL(file)
  })
}
```

#### 4-5. 개별 프롬프트 공유

`crypto.randomUUID()`로 고유 토큰 생성 → `is_public = true`, `share_token` 업데이트 → `/share/[token]` 공개 페이지.

#### 4-6. 프롬프트 순서 정렬

초기에는 `@dnd-kit`으로 드래그앤드롭을 시도했으나 UX 복잡도 및 모바일 호환성 문제로 **위/아래 버튼 방식**으로 전환:

```typescript
const reorderPrompts = async (ordered: Prompt[]) => {
  setPrompts(ordered) // 낙관적 업데이트
  const results = await Promise.all(
    ordered.map((p, i) =>
      supabase.from('prompts').update({ sort_order: i }).eq('id', p.id)
    )
  )
  if (failed) {
    toast.error('순서 저장 실패')
    await fetchPrompts() // 실패 시 서버 데이터로 복원
  }
}
```

---

### Phase 5 — 검색 기능

**목표:** 실시간 제목·내용·태그 검색 + 해시태그 전용 검색

**구현 파일:** `lib/hooks/useSearch.ts`, `components/search/SearchBar.tsx`

```typescript
// 일반 검색: ilike + 태그 contains 병렬 실행
const escapedLike = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')
const [{ data: textData }, { data: tagData }] = await Promise.all([
  supabase.from('prompts').select('*')
    .or(`title.ilike.%${escapedLike}%,content.ilike.%${escapedLike}%`).limit(50),
  supabase.from('prompts').select('*')
    .contains('tags', [trimmed]).limit(20),
])

// #태그 검색: 로컬 배열 부분 일치 필터링
if (trimmed.startsWith('#')) {
  const tagKeyword = trimmed.slice(1).toLowerCase()
  const filtered = data.filter((p) =>
    p.tags.some((t) => t.toLowerCase().includes(tagKeyword))
  )
}
```

300ms 디바운스로 타이핑 중 과도한 쿼리 방지. 검색어 길이 100자 제한(보안 강화 시 추가).

---

### Phase 6 — 웹사이트 북마크

**목표:** URL 북마크 관리, Microlink API로 썸네일·제목 자동 가져오기

**구현 파일:** `components/websites/WebsiteList.tsx`, `components/websites/WebsiteCard.tsx`, `components/websites/WebsiteEditor.tsx`, `app/api/fetch-thumbnail/route.ts`

```typescript
// 썸네일 자동 가져오기 (스크린샷 우선, og:image 폴백)
const apiUrl = new URL('https://api.microlink.io')
apiUrl.searchParams.set('url', url)
apiUrl.searchParams.set('screenshot', 'true')
const thumbnail = json.data.screenshot?.url ?? json.data.image?.url ?? null
```

- 북마크 폴더는 FolderTree에서 타입 선택 시 자동 구분
- 앱 최초 실행 시 '북마크' 웹사이트 폴더 자동 생성 (`useEffect`로 처리)

---

### Phase 7 — 전체 컬렉션 공유

**목표:** 전체 프롬프트를 2일 만료 링크로 공유, 읽기 전용

**구현 파일:** `app/api/collection-share/route.ts`, `app/collection/[token]/page.tsx`, `components/collection/CollectionShareButton.tsx`

#### 보안 설계

- 토큰: `encode(gen_random_bytes(16), 'hex')` — 32자 랜덤 hex
- RLS 정책으로 토큰 없이는 데이터 접근 불가
- 공유 페이지는 서버 컴포넌트(SSR) — 서버에서 토큰 검증 후 렌더링

```typescript
// collection_shares 유효성 검증 → prompts 조회 (SSR)
const { data: share } = await supabase
  .from('collection_shares')
  .select('user_id, expires_at')
  .eq('token', token)
  .gt('expires_at', new Date().toISOString())
  .single()

if (!share) notFound()
```

#### API 설계 (REST)

| 메서드 | 동작 |
|--------|------|
| `GET /api/collection-share` | 현재 공유 상태 확인 |
| `POST /api/collection-share` | 공유 생성/갱신 (기존 삭제 후 재생성) |
| `DELETE /api/collection-share` | 공유 즉시 중지 |

---

### Phase 8 — UI/UX 개선

#### 해시태그 한 줄 스크롤

다중 줄 태그 표시 → 한 줄 가로 스크롤로 변경:

```tsx
// 두 div 래퍼: 외부(overflow-x-auto) + 내부(flex-nowrap)
<div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
  <div className="flex gap-1 flex-nowrap">
    {tags.map((tag) => <Badge className="shrink-0">{tag}</Badge>)}
  </div>
</div>
```

#### 뷰 모드 전환

그리드(카드) / 리스트 뷰 전환. 상태를 `localStorage`에 저장하지 않고 세션 내 유지.

#### 다크모드

`next-themes` 라이브러리로 라이트/다크/시스템 3단계 전환. Tailwind CSS v4 `dark:` 클래스 활용.

---

### Phase 9 — 보안 강화

전체 보안 점검 후 다음 항목 수정:

| 항목 | 심각도 | 조치 내용 |
|------|--------|-----------|
| 미들웨어 미작동 | CRITICAL | `proxy.ts` → `middleware.ts` 변경, `export default` 적용 |
| SSRF 취약점 | HIGH | 내부 IP(localhost, 10.x.x.x 등) 차단 패턴 추가 |
| LIKE 와일드카드 미이스케이프 | HIGH | `%`, `_` 이스케이프 + 100자 길이 제한 |
| 인증 콜백 오류 무시 | MEDIUM | 세션 교환 실패 시 `/login?error=auth_failed` 리디렉션 |
| 회원가입 에러 메시지 노출 | MEDIUM | Supabase 내부 메시지 → 일반화된 한국어 메시지 |
| 보안 HTTP 헤더 미설정 | LOW | `X-Frame-Options`, `X-Content-Type-Options` 등 추가 |

---

### Phase 10 — 라이센스 및 문서화

- `LICENSE` (MIT) 파일 생성
- `package.json` `author`, `license` 필드 추가
- `app/layout.tsx` HTML 메타데이터 (`authors`, `creator`) 추가
- 공유 페이지 푸터 저작권 표시
- **사용설명서 모달** (`HelpModal.tsx`) — 6개 섹션, 항목별 펼치기/접기

---

## 6. 주요 기술 도전과 해결 방안

### 도전 1. PostgREST 스키마 캐시 문제

**문제:** `folder_type` 컬럼을 `folders` 테이블에 추가했으나 Vercel 배포 환경에서 PostgREST가 새 컬럼을 인식하지 못해 쿼리 실패.

**해결:** DB 컬럼 추가를 포기하고, `folder_type` 정보를 Supabase Auth의 `user_metadata`에 `website_folder_ids: string[]` 배열로 저장. 조회 시 두 소스를 병합:

```typescript
const [{ data }, websiteIds] = await Promise.all([
  supabase.from('folders').select('id, name, parent_id, ...'),
  loadWebsiteIds(supabase),
])
const typed = data.map((f) => ({
  ...f,
  folder_type: websiteIds.has(f.id) ? 'website' : 'prompt',
}))
```

### 도전 2. 미들웨어 미작동

**문제:** Next.js 미들웨어를 `proxy.ts`로 작성하고 `export function proxy`로 내보냈으나 실제로는 동작하지 않아 인증 보호가 우회 가능한 상태.

**원인 분석:** Next.js는 미들웨어를 반드시 `middleware.ts` (루트 위치) + `export default function middleware`로 인식합니다.

**해결:** 파일 이름을 `middleware.ts`로 변경, `export default async function middleware`로 수정.

### 도전 3. 프롬프트 순서 변경 오해

**문제:** 사용자가 "전체 프롬프트 순서변경 안됨"이라고 보고했고, 처음에는 프롬프트 목록의 정렬 문제로 해석.

**진짜 요구사항:** "좌측 폴더 만들기 메뉴버튼 아래쪽 만들어진 메뉴들 순서를 바꾸는 것" — 사이드바 폴더 순서 변경이었습니다.

**해결:** `folders` 테이블에 `sort_order` 컬럼 추가, `FolderNode` 드롭다운에 "위로/아래로 이동" 메뉴 구현, `reorderFolders` 함수로 형제 노드 순서 일괄 저장.

### 도전 4. 해시태그 한 줄 스크롤

**문제:** `flex-wrap` 제거 후 `overflow-x-auto`를 단일 div에 적용했으나 스크롤이 동작하지 않음.

**원인:** 부모 컨테이너에 `min-width` 제약이 없어 flex item이 늘어남.

**해결:** 두 div 래퍼 구조로 분리:
```tsx
// 외부: overflow-x-auto (스크롤 컨테이너)
// 내부: flex flex-nowrap (줄바꿈 없는 flex)
```
+ `style={{ scrollbarWidth: 'none' }}`로 스크롤바 숨김 (inline style로 크로스브라우저 지원).

### 도전 5. Vercel 자동 배포 미작동

**문제:** `git push` 후에도 Vercel 자동 배포가 트리거되지 않는 상황 발생.

**해결:** Vercel CLI 직접 사용:

```bash
npx vercel login      # 브라우저 인증
npx vercel --prod --yes  # 강제 프로덕션 배포
```

---

## 7. 보안 점검 및 개선

### 점검 결과 요약

| 심각도 | 건수 | 상태 |
|--------|------|------|
| CRITICAL | 2 | ✅ 수정 완료 |
| HIGH | 4 | ✅ 코드 수정 완료 (2건), ℹ️ RLS로 완화 (2건) |
| MEDIUM | 3 | ✅ 수정 완료 |
| LOW | 2 | ✅ 수정 완료 |

### 잘 설계된 보안 항목

- 모든 API 라우트에 `supabase.auth.getUser()` 인증 체크
- PostgreSQL RLS로 데이터 계층 보호 (DB 레벨)
- 공유 토큰: `crypto.randomUUID()` / `gen_random_bytes(16)` 예측 불가능한 값
- 비밀번호 직접 처리 없음 (Supabase Auth 위임)
- `.env.local` `.gitignore`로 시크릿 보호
- 에러 로그는 서버(`console.error`)에만, 클라이언트에 상세 내용 미노출

---

## 8. 배포 과정

### 초기 배포 설정

1. Vercel 대시보드에서 GitHub 저장소 연결
2. 환경 변수 등록:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `MICROLINK_API_KEY` (선택)
3. Supabase 대시보드에서 이메일 템플릿 수정 (인증 URL 커스텀 도메인 설정)
4. Supabase Auth → URL Configuration → Site URL: Vercel 배포 도메인 등록

### 배포 명령어 (수동)

```bash
cd prompt-manager
npx vercel --prod --yes
```

### 배포 URL

```
https://prompt-manager-three-coral.vercel.app
```

---

## 9. 최종 파일 구조

```
prompt-manager/
├── app/
│   ├── api/
│   │   ├── collection-share/route.ts   # 컬렉션 공유 CRUD API
│   │   ├── extract-keyword/route.ts    # AI 키워드 추출 API
│   │   └── fetch-thumbnail/route.ts    # 웹사이트 썸네일 API
│   ├── auth/callback/route.ts          # 이메일 인증 콜백
│   ├── collection/[token]/             # 컬렉션 공유 공개 페이지
│   │   ├── page.tsx
│   │   └── CopyButton.tsx
│   ├── dashboard/
│   │   ├── page.tsx                    # 대시보드 서버 컴포넌트 (인증 체크)
│   │   ├── DashboardClient.tsx         # 대시보드 클라이언트 UI
│   │   └── ClientWrapper.tsx
│   ├── share/[token]/                  # 개별 프롬프트 공유 페이지
│   │   ├── page.tsx
│   │   ├── CopyButton.tsx
│   │   └── not-found.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── layout.tsx                      # 루트 레이아웃 + 메타데이터
│   ├── globals.css
│   └── providers.tsx                   # ThemeProvider
├── components/
│   ├── auth/AuthForm.tsx               # 로그인/회원가입 폼
│   ├── collection/
│   │   └── CollectionShareButton.tsx   # 전체 공유 버튼
│   ├── folders/
│   │   ├── FolderTree.tsx              # 폴더 트리 + CRUD 모달
│   │   └── FolderNode.tsx              # 재귀 폴더 노드
│   ├── layout/
│   │   ├── Sidebar.tsx                 # 좌측 사이드바
│   │   ├── HelpModal.tsx               # 사용설명서 모달
│   │   └── ThemeToggle.tsx             # 다크모드 토글
│   ├── prompts/
│   │   ├── PromptCard.tsx              # 프롬프트 카드 (그리드/리스트)
│   │   ├── PromptEditor.tsx            # 프롬프트 에디터 모달
│   │   └── PromptList.tsx              # 프롬프트 목록
│   ├── search/SearchBar.tsx            # 검색바
│   ├── websites/
│   │   ├── WebsiteCard.tsx             # 북마크 카드
│   │   ├── WebsiteEditor.tsx           # 북마크 에디터 모달
│   │   └── WebsiteList.tsx             # 북마크 목록
│   └── ui/                             # shadcn/ui 컴포넌트 (badge, button, dialog ...)
├── lib/
│   ├── hooks/
│   │   ├── useFolders.ts               # 폴더 데이터 훅 (CRUD + 트리)
│   │   ├── usePrompts.ts               # 프롬프트 데이터 훅 (CRUD + 정렬)
│   │   ├── usePromptCounts.ts          # 폴더별 프롬프트 수 (Realtime)
│   │   └── useSearch.ts                # 실시간 검색 훅
│   ├── supabase/
│   │   ├── client.ts                   # 브라우저용 Supabase 클라이언트
│   │   └── server.ts                   # 서버용 Supabase 클라이언트
│   ├── types/index.ts                  # 공통 타입 정의
│   └── utils.ts                        # cn, extractHashtags 유틸
├── supabase/schema.sql                 # DB 스키마 + RLS + 인덱스
├── middleware.ts                       # 인증 미들웨어 (세션 갱신 + 라우팅)
├── next.config.ts                      # 보안 HTTP 헤더 설정
├── package.json
├── LICENSE                             # MIT License
└── REPORT.md                           # 본 개발 보고서
```

---

## 10. 기능 요약

| 기능 | 설명 |
|------|------|
| **인증** | 이메일/비밀번호 회원가입·로그인, 이메일 인증, 세션 자동 갱신 |
| **폴더 관리** | 무한 중첩, 타입(프롬프트/웹사이트) 구분, 수동 순서 정렬 |
| **프롬프트 CRUD** | 마크다운 에디터, 서식 툴바, 태그, 이미지, 참조 링크 |
| **해시태그** | 내용에서 #태그 자동 감지 및 추가 제안 |
| **AI 키워드** | Anthropic Claude Haiku로 핵심 단어 자동 추출 |
| **검색** | 실시간 제목·내용·태그 검색, #태그 전용 검색 |
| **웹사이트 북마크** | URL 저장, Microlink로 썸네일·제목 자동 추출 |
| **개별 공유** | 프롬프트 1개를 비로그인 공개 링크로 공유 (만료 없음) |
| **전체 공유** | 전체 프롬프트 컬렉션을 2일 만료 읽기 전용 링크로 공유 |
| **정렬** | 프롬프트·폴더 상하 이동 버튼으로 수동 순서 변경 |
| **다크모드** | 라이트/다크/시스템 3단계 테마 전환 |
| **뷰 전환** | 그리드(카드) / 리스트 뷰 전환 |
| **사이드바** | 접기/펼치기, 브레드크럼 네비게이션 |
| **사용설명서** | 인앱 도움말 모달 (6개 섹션, 펼치기/접기) |
| **보안** | RLS, 인증 미들웨어, SSRF 방어, 보안 HTTP 헤더 |
| **라이센스** | MIT License — Naku Lab Studio |

---

*© 2026 Naku Lab Studio · naku.lab.studio@kakao.com*
