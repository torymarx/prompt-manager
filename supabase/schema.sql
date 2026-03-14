-- ============================================================
-- 프롬프트 매니저 - Supabase DB 스키마 + RLS
-- Supabase SQL Editor에 전체 붙여넣고 실행하세요.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. 테이블 생성
-- ──────────────────────────────────────────────────────────

-- 폴더 테이블
CREATE TABLE IF NOT EXISTS public.folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disable_share BOOLEAN NOT NULL DEFAULT false
);

-- 프롬프트 테이블
CREATE TABLE IF NOT EXISTS public.prompts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id    UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  image_url    TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  share_token  UUID UNIQUE,
  disable_share BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 컬렉션 공유 테이블
CREATE TABLE IF NOT EXISTS public.collection_shares (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────
-- 2. 추가 컬럼 (기존 테이블 존재 시 대비)
-- ⚠️ 중요: RLS 정책에서 참조하기 전에 컬럼이 존재해야 함
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS disable_share BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS disable_share BOOLEAN NOT NULL DEFAULT false;


-- ──────────────────────────────────────────────────────────
-- 3. 인덱스 (성능 최적화)
-- ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_folder_id ON public.prompts(folder_id);
CREATE INDEX IF NOT EXISTS idx_prompts_share_token ON public.prompts(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_is_public ON public.prompts(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON public.prompts USING GIN(tags);


-- ──────────────────────────────────────────────────────────
-- 4. updated_at 자동 갱신 트리거
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
-- 5. RLS 활성화
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_shares ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────
-- 6. folders RLS 정책
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "folders_select" ON public.folders;
CREATE POLICY "folders_select" ON public.folders FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_insert" ON public.folders;
CREATE POLICY "folders_insert" ON public.folders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_update" ON public.folders;
CREATE POLICY "folders_update" ON public.folders FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_delete" ON public.folders;
CREATE POLICY "folders_delete" ON public.folders FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 컬렉션 공유를 통한 폴더 조회 (비로그인 포함)
DROP POLICY IF EXISTS "anon_read_folders_via_collection_share" ON public.folders;
CREATE POLICY "anon_read_folders_via_collection_share"
  ON public.folders FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_shares cs
      WHERE cs.user_id = folders.user_id
        AND cs.expires_at > now()
    )
    AND folders.disable_share = false
  );


-- ──────────────────────────────────────────────────────────
-- 7. prompts RLS 정책
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "prompts_select_own" ON public.prompts;
CREATE POLICY "prompts_select_own" ON public.prompts FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prompts_select_public" ON public.prompts;
CREATE POLICY "prompts_select_public" ON public.prompts FOR SELECT TO anon, authenticated USING (is_public = true AND share_token IS NOT NULL);

DROP POLICY IF EXISTS "prompts_insert" ON public.prompts;
CREATE POLICY "prompts_insert" ON public.prompts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "prompts_update" ON public.prompts;
CREATE POLICY "prompts_update" ON public.prompts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "prompts_delete" ON public.prompts;
CREATE POLICY "prompts_delete" ON public.prompts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 컬렉션 공유를 통한 프롬프트 조회 (비로그인 포함)
DROP POLICY IF EXISTS "anon_read_prompts_via_collection_share" ON public.prompts;
CREATE POLICY "anon_read_prompts_via_collection_share"
  ON public.prompts FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_shares cs
      WHERE cs.user_id = prompts.user_id
        AND cs.expires_at > now()
    )
    AND prompts.disable_share = false
  );


-- ──────────────────────────────────────────────────────────
-- 8. collection_shares RLS 정책
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "collection_shares_all_own" ON public.collection_shares;
CREATE POLICY "collection_shares_all_own" ON public.collection_shares FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "collection_shares_select_valid" ON public.collection_shares;
CREATE POLICY "collection_shares_select_valid" ON public.collection_shares FOR SELECT TO anon, authenticated USING (expires_at > now());


-- ──────────────────────────────────────────────────────────
-- 9. Realtime 및 Storage 정책
-- ──────────────────────────────────────────────────────────

-- Realtime (이미 존재할 경우 에러를 피하기 위해 DO 블록 사용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'prompts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prompts;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime 활성화 건너뜀 (이미 설정되어 있을 수 있음)';
END;
$$;

-- Storage (thumbnails 버킷은 대시보드에서 수동 생성 필요)
DROP POLICY IF EXISTS "thumbnails_insert" ON storage.objects;
CREATE POLICY "thumbnails_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "thumbnails_select" ON storage.objects;
CREATE POLICY "thumbnails_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "thumbnails_delete" ON storage.objects;
CREATE POLICY "thumbnails_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'thumbnails');


-- ──────────────────────────────────────────────────────────
-- 완료 확인
-- ──────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ 스키마 설정 완료';
  RAISE NOTICE '  - 테이블/컬럼 설정 및 RLS 강화 완료';
  RAISE NOTICE '  - 공유 제한(disable_share) 필터 적용 완료';
END;
$$;
