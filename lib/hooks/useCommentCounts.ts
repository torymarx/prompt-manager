'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * 프롬프트별 댓글 갯수를 관리하는 훅
 * Supabase Realtime을 통해 댓글 추가/삭제 시 즉시 업데이트됨
 */
export function useCommentCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const supabase = createClient()

  const fetchCounts = useCallback(async () => {
    // 성능을 위해 prompt_id만 가져와서 로컬에서 그룹화
    const { data, error } = await supabase
      .from('comments')
      .select('prompt_id')

    if (error) {
      console.error('Fetch comment counts error:', error)
      return
    }

    if (data) {
      const map: Record<string, number> = {}
      data.forEach(({ prompt_id }) => {
        if (prompt_id) {
          map[prompt_id] = (map[prompt_id] ?? 0) + 1
        }
      })
      setCounts(map)
    }
  }, [supabase])

  useEffect(() => {
    fetchCounts()

    // 댓글 생성/삭제 시 실시간 반영
    const channel = supabase
      .channel('comment-counts-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => fetchCounts()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCounts, supabase])

  return counts
}
