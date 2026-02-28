'use client'

// 폴더 데이터 관리 훅
// folder_type → Supabase Auth user_metadata에 저장 (PostgREST 스키마 캐시 완전 우회)
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Folder } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Auth 메타데이터 기반 웹사이트 폴더 ID 관리 ────────────────────────────

async function loadWebsiteIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser()
  const ids = (user?.user_metadata?.website_folder_ids ?? []) as string[]
  return new Set(ids)
}

async function saveWebsiteIds(supabase: SupabaseClient, ids: Set<string>): Promise<void> {
  await supabase.auth.updateUser({
    data: { website_folder_ids: [...ids] },
  })
}

// ── 트리/유틸 함수 ────────────────────────────────────────────────────────

/** 특정 폴더의 모든 하위 폴더 ID 재귀 수집 */
export function getDescendantIds(folderId: string, allFolders: Folder[]): string[] {
  const result: string[] = []
  for (const f of allFolders) {
    if (f.parent_id === folderId) {
      result.push(f.id)
      result.push(...getDescendantIds(f.id, allFolders))
    }
  }
  return result
}

/** 평탄한 폴더 배열을 트리 구조로 변환 */
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

// ── 훅 ───────────────────────────────────────────────────────────────────

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [tree, setTree] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // folder_type 제외한 컬럼만 select (스키마 캐시 문제 회피)
  const fetchFolders = useCallback(async () => {
    const [{ data, error }, websiteIds] = await Promise.all([
      supabase
        .from('folders')
        .select('id, user_id, name, parent_id, created_at, updated_at')
        .order('name'),
      loadWebsiteIds(supabase),
    ])

    if (error) {
      console.error('[fetchFolders]', error.code, error.message)
      toast.error('폴더를 불러오는 데 실패했습니다.')
    } else if (data) {
      const typed: Folder[] = data.map((f) => ({
        ...f,
        folder_type: websiteIds.has(f.id) ? 'website' : 'prompt',
      }))
      setFolders(typed)
      setTree(buildFolderTree(typed))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchFolders() }, [fetchFolders])

  // 폴더 생성 - folder_type은 user_metadata에 저장
  const createFolder = async (
    name: string,
    parentId: string | null = null,
    type: 'prompt' | 'website' = 'prompt'
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('로그인이 필요합니다.')
      return null
    }

    const { data, error } = await supabase
      .from('folders')
      .insert({ name, parent_id: parentId, user_id: user.id })
      .select('id, user_id, name, parent_id, created_at, updated_at')
      .single()

    if (error) {
      console.error('[createFolder]', error.code, error.message)
      toast.error('폴더 생성에 실패했습니다.')
      return null
    }

    // 웹사이트 폴더면 user_metadata에 ID 추가
    if (type === 'website') {
      const ids = await loadWebsiteIds(supabase)
      ids.add(data.id)
      await saveWebsiteIds(supabase, ids)
    }

    toast.success(`"${name}" 폴더가 생성되었습니다.`)
    await fetchFolders()
    return { ...data, folder_type: type } as Folder
  }

  // 폴더 이름 변경
  const renameFolder = async (id: string, name: string) => {
    const { error } = await supabase.from('folders').update({ name }).eq('id', id)
    if (error) {
      toast.error('폴더 이름 변경에 실패했습니다.')
      return
    }
    toast.success('폴더 이름이 변경되었습니다.')
    await fetchFolders()
  }

  // 폴더 삭제 - user_metadata에서도 제거
  const deleteFolder = async (id: string) => {
    const { error } = await supabase.from('folders').delete().eq('id', id)
    if (error) {
      toast.error('폴더 삭제에 실패했습니다.')
      return
    }
    const ids = await loadWebsiteIds(supabase)
    if (ids.has(id)) {
      ids.delete(id)
      await saveWebsiteIds(supabase, ids)
    }
    toast.success('폴더가 삭제되었습니다.')
    await fetchFolders()
  }

  return { folders, tree, loading, createFolder, renameFolder, deleteFolder, refetch: fetchFolders }
}
