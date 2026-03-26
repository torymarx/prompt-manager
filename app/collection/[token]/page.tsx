// 컬렉션 공유 페이지 - 비로그인 사용자도 접근 가능한 서버 컴포넌트
// 대시보드 스타일 읽기 전용 뷰 (2일 만료) - 검색·복사만 가능
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CollectionViewerClient } from './CollectionViewerClient'
import type { Prompt, Folder } from '@/lib/types'

interface CollectionPageProps {
  params: Promise<{ token: string }>
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { token } = await params
  const supabase = await createClient()

  // 토큰으로 유효한 공유 조회 (만료 전만)
  const { data: share } = await supabase
    .from('collection_shares')
    .select('user_id, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!share) notFound()

  // 폴더 + 프롬프트 병렬 조회
  // folders: anon_read_folders_via_collection_share RLS 정책으로 비로그인 접근 허용
  const [{ data: rawFolders }, { data: rawPrompts }] = await Promise.all([
    supabase
      .from('folders')
      .select('id, user_id, name, parent_id, sort_order, created_at, updated_at')
      .eq('user_id', share.user_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('prompts')
      .select('id, folder_id, title, content, tags, image_url, image_urls, link_url, created_at, sort_order')
      .eq('user_id', share.user_id)
      .eq('disable_share', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  // --- Restricted Sharing Logic ---
  // "인물" 또는 "그림"이 포함된 폴더 및 그 하위 폴더만 통과
  const allowedKeywordRegex = /인물|그림/

  // 1. 이름으로 직접 매칭되는 상위 폴더 찾기
  const matchingRootFolders = (rawFolders ?? []).filter(f => allowedKeywordRegex.test(f.name))
  const allowedFolderIds = new Set<string>()

  // 2. 매칭된 폴더와 그 모든 후손 폴더 ID 수집
  const collectDescendantIds = (parentId: string) => {
    allowedFolderIds.add(parentId)
    rawFolders?.forEach(f => {
      if (f.parent_id === parentId && !allowedFolderIds.has(f.id)) {
        collectDescendantIds(f.id)
      }
    })
  }

  matchingRootFolders.forEach(f => collectDescendantIds(f.id))

  // 3. 필터링된 폴더 변환
  const folders: Folder[] = (rawFolders ?? [])
    .filter(f => allowedFolderIds.has(f.id))
    .map((f) => ({
      id: f.id,
      user_id: f.user_id,
      name: f.name,
      parent_id: f.parent_id ?? null,
      folder_type: 'prompt' as const,
      sort_order: f.sort_order ?? 0,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }))

  // 4. 필터링된 프롬프트 변환 (허용된 폴더에 속한 것만)
  const prompts: Prompt[] = (rawPrompts ?? [])
    .filter(p => p.folder_id && allowedFolderIds.has(p.folder_id))
    .map((p) => ({
      id: p.id,
      user_id: share.user_id,
      folder_id: p.folder_id ?? null,
      title: p.title,
      content: p.content,
      tags: p.tags ?? [],
      image_url: p.image_url ?? null,
      image_urls: p.image_urls ?? null,
      link_url: p.link_url ?? null,
      sort_order: p.sort_order ?? 0,
      is_public: false,
      share_token: null,
      disable_share: false,
      created_at: p.created_at,
      updated_at: p.created_at,
    }))

  const expiresAt = new Date(share.expires_at)
  const expiresLabel = `${expiresAt.toLocaleDateString('ko-KR')} ${expiresAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`

  return <CollectionViewerClient prompts={prompts} folders={folders} expiresLabel={expiresLabel} />
}
