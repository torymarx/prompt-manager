'use client'

// 프롬프트 데이터 관리 훅 - CRUD + 에러 처리
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Prompt } from '@/lib/types'

// folderIds: undefined → 전체 조회 / string[] → 해당 폴더 + 하위 폴더 포함 조회
export function usePrompts(folderIds?: string[]) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // 배열 내용 기준 메모이제이션 (참조 변경 무시)
  const folderIdsKey = folderIds ? JSON.stringify(folderIds) : undefined

  const fetchPrompts = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('prompts').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false })

    // folderIds가 있으면 해당 폴더들만 조회, 없으면 전체 조회
    const ids: string[] | undefined = folderIdsKey ? JSON.parse(folderIdsKey) : undefined
    if (ids !== undefined) {
      if (ids.length === 0) {
        // 폴더 ID가 비어있으면 결과 없음
        setPrompts([])
        setLoading(false)
        return
      }
      query = query.in('folder_id', ids)
    }

    const { data, error } = await query
    if (error) {
      toast.error('프롬프트를 불러오는 데 실패했습니다.')
    } else if (data) {
      setPrompts(data)
    }
    setLoading(false)
  }, [folderIdsKey])

  useEffect(() => { fetchPrompts() }, [fetchPrompts])

  // 프롬프트 생성
  const createPrompt = async (values: Omit<Prompt, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('로그인이 필요합니다.')
      return null
    }

    const { data, error } = await supabase
      .from('prompts')
      .insert({ ...values, user_id: user.id })
      .select()
      .single()

    if (error) {
      toast.error('프롬프트 생성에 실패했습니다.')
      return null
    }

    toast.success('프롬프트가 생성되었습니다.')
    await fetchPrompts()
    return data
  }

  // 프롬프트 수정
  const updatePrompt = async (id: string, values: Partial<Omit<Prompt, 'id' | 'user_id'>>) => {
    const { error } = await supabase.from('prompts').update(values).eq('id', id)
    if (error) {
      toast.error('프롬프트 수정에 실패했습니다.')
      return
    }
    toast.success('프롬프트가 수정되었습니다.')
    await fetchPrompts()
  }

  // 프롬프트 삭제
  const deletePrompt = async (id: string) => {
    const { error } = await supabase.from('prompts').delete().eq('id', id)
    if (error) {
      toast.error('프롬프트 삭제에 실패했습니다.')
      return
    }
    toast.success('프롬프트가 삭제되었습니다.')
    await fetchPrompts()
  }

  // 공유 토글 - isPublic=true 시 토큰 생성, false 시 비공개로 전환
  const toggleShare = async (id: string, isPublic: boolean) => {
    if (isPublic) {
      const share_token = crypto.randomUUID()
      const { error } = await supabase
        .from('prompts')
        .update({ is_public: true, share_token })
        .eq('id', id)
      if (error) {
        toast.error('공유 설정에 실패했습니다.')
        return null
      }
      await fetchPrompts()
      return share_token
    } else {
      const { error } = await supabase
        .from('prompts')
        .update({ is_public: false })
        .eq('id', id)
      if (error) {
        toast.error('공유 중지에 실패했습니다.')
        return null
      }
      toast.success('공유가 중지되었습니다.')
      await fetchPrompts()
      return null
    }
  }

  // 드래그 후 순서 일괄 저장
  const reorderPrompts = async (ordered: Prompt[]) => {
    setPrompts(ordered) // 낙관적 업데이트
    const updates = ordered.map((p, i) =>
      supabase.from('prompts').update({ sort_order: i }).eq('id', p.id)
    )
    await Promise.all(updates)
  }

  return { prompts, loading, createPrompt, updatePrompt, deletePrompt, toggleShare, reorderPrompts, refetch: fetchPrompts }
}
