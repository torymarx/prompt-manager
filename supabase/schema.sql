-- ============================================================
-- 프롬프트 매니저 - Supabase DB 스키마 + RLS
-- Supabase SQL Editor에 전체 붙여넣고 실행하세요.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. 테이블 생성
-- ──────────────────────────────────────────────────────────

-- 폴더 테이블
-- folder_type은 Auth user_metadata에 저장하므로 DB 컬럼 없음
CREATE TABLE IF NOT EXISTS public.folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES public.folders(id) ON DELETE CASCADE, -- 부모 삭제 시 자식도 삭제
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 프롬프트 테이블
CREATE TABLE IF NOT EXISTS public.prompts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id    UUID REFERENCES public.folders(id) ON DELETE SET NULL, -- 폴더 삭제 시 미분류로 이동
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  image_url    TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  share_token  UUID UNIQUE,                                            -- 공유 링크 토큰
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────
-- 2. 인덱스 (성능 최적화)
-- ──────────────────────────────────────────────────────────

-- 사용자별 폴더 조회
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
-- 부모 폴더 기준 하위 조회
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);

-- 사용자별 프롬프트 조회
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
-- 폴더별 프롬프트 조회
CREATE INDEX IF NOT EXISTS idx_prompts_folder_id ON public.prompts(folder_id);
-- 공유 토큰 조회 (share 페이지)
CREATE INDEX IF NOT EXISTS idx_prompts_share_token ON public.prompts(share_token) WHERE share_token IS NOT NULL;
-- 공개 프롬프트 조회
CREATE INDEX IF NOT EXISTS idx_prompts_is_public ON public.prompts(is_public) WHERE is_public = true;
-- 태그 GIN 인덱스 (배열 contains 검색)
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON public.prompts USING GIN(tags);


-- ──────────────────────────────────────────────────────────
-- 3. updated_at 자동 갱신 트리거
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_folders_updated_at ON public.folders;
CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prompts_updated_at ON public.prompts;
CREATE TRIGGER trg_prompts_updated_at
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 4. RLS 활성화
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────
-- 5. folders RLS 정책
-- 자신의 폴더만 조회·생성·수정·삭제 가능
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "folders_select" ON public.folders;
CREATE POLICY "folders_select"
  ON public.folders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_insert" ON public.folders;
CREATE POLICY "folders_insert"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_update" ON public.folders;
CREATE POLICY "folders_update"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_delete" ON public.folders;
CREATE POLICY "folders_delete"
  ON public.folders FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- 6. prompts RLS 정책
-- ──────────────────────────────────────────────────────────

-- SELECT: 내 프롬프트 OR 공개 프롬프트 (비로그인 포함, share 페이지용)
DROP POLICY IF EXISTS "prompts_select_own" ON public.prompts;
CREATE POLICY "prompts_select_own"
  ON public.prompts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prompts_select_public" ON public.prompts;
CREATE POLICY "prompts_select_public"
  ON public.prompts FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND share_token IS NOT NULL);

-- INSERT: 자신의 프롬프트만 생성
DROP POLICY IF EXISTS "prompts_insert" ON public.prompts;
CREATE POLICY "prompts_insert"
  ON public.prompts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 자신의 프롬프트만 수정
DROP POLICY IF EXISTS "prompts_update" ON public.prompts;
CREATE POLICY "prompts_update"
  ON public.prompts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: 자신의 프롬프트만 삭제
DROP POLICY IF EXISTS "prompts_delete" ON public.prompts;
CREATE POLICY "prompts_delete"
  ON public.prompts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- 7. Realtime 활성화 (usePromptCounts 훅 실시간 동기화용)
-- ──────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.prompts;


-- ──────────────────────────────────────────────────────────
-- 8. Storage 버킷 및 정책
-- ⚠️  버킷은 SQL로 생성 불가 → Supabase 대시보드에서 수동 생성 필요
--    Storage → New Bucket → Name: thumbnails, Public: ON
-- ──────────────────────────────────────────────────────────

-- 인증된 사용자: 업로드 허용
CREATE POLICY IF NOT EXISTS "thumbnails_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'thumbnails');

-- 전체 공개: 이미지 조회 허용 (공유 링크용)
CREATE POLICY IF NOT EXISTS "thumbnails_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'thumbnails');

-- 인증된 사용자: 이미지 삭제 허용
CREATE POLICY IF NOT EXISTS "thumbnails_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'thumbnails');


-- ──────────────────────────────────────────────────────────
-- 완료 확인
-- ──────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ 스키마 설정 완료';
  RAISE NOTICE '  - 테이블: folders, prompts';
  RAISE NOTICE '  - 인덱스: 7개';
  RAISE NOTICE '  - 트리거: updated_at 자동 갱신';
  RAISE NOTICE '  - RLS: 활성화 (folders 4개, prompts 5개 정책)';
  RAISE NOTICE '  - Realtime: prompts 테이블';
  RAISE NOTICE '  - Storage: thumbnails 버킷 정책 (버킷은 대시보드에서 수동 생성)';
END;
$$;
