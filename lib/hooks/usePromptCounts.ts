'use client'

// folder_id 별 직접 저장된 프롬프트 수 반환
// Supabase Realtime으로 CRUD 시 자동 업데이트
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePromptCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const supabase = createClient()

  const fetchCounts = useCallback(async () => {
    const { data } = await supabase.from('prompts').select('folder_id')
    if (data) {
      const map: Record<string, number> = {}
      data.forEach(({ folder_id }) => {
        if (folder_id) {
          map[folder_id] = (map[folder_id] ?? 0) + 1
        }
      })
      setCounts(map)
    }
  }, [])

  useEffect(() => {
    fetchCounts()

    // 프롬프트 생성/수정/삭제 시 실시간 반영
    const channel = supabase
      .channel('prompt-counts-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompts' }, fetchCounts)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchCounts])

  return counts
}
