'use client'

// 실시간 검색 훅 - 제목·태그·내용 검색 + 해시태그(#) 쿼리 지원
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Prompt } from '@/lib/types'

/** 텍스트에서 키워드를 <mark>로 감싸서 반환 */
export function highlight(text: string, keyword: string): string {
  if (!keyword.trim()) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>')
}

export function useSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Prompt[]>([])
  const [searching, setSearching] = useState(false)
  const supabase = createClient()

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    setSearching(true)

    // #태그 형식이면 태그 전용 검색
    if (trimmed.startsWith('#')) {
      const tagKeyword = trimmed.slice(1).toLowerCase()
      if (!tagKeyword) {
        setResults([])
        setSearching(false)
        return
      }

      // tags 배열에서 해당 키워드를 포함하는 프롬프트 검색 (부분 일치)
      const { data } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      // Supabase의 contains는 정확한 매칭이므로, 클라이언트에서 부분 일치 필터링
      const filtered = (data ?? []).filter((p: Prompt) =>
        p.tags.some((t) => t.toLowerCase().includes(tagKeyword))
      )

      setResults(filtered)
      setSearching(false)
      return
    }

    // 일반 검색: 제목·내용·태그 모두 검색
    const [{ data: textData }, { data: tagData }] = await Promise.all([
      // 제목·내용 텍스트 검색
      supabase
        .from('prompts')
        .select('*')
        .or(`title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`)
        .order('created_at', { ascending: false })
        .limit(50),

      // 정확한 태그 매칭
      supabase
        .from('prompts')
        .select('*')
        .contains('tags', [trimmed])
        .limit(20),
    ])

    // 중복 제거 후 합치기
    const combined = [...(textData ?? []), ...(tagData ?? [])]
    const unique = combined.filter((item, idx, arr) =>
      arr.findIndex((i) => i.id === item.id) === idx
    )

    setResults(unique)
    setSearching(false)
  }, [])

  // 디바운스: 300ms 후 검색 실행
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  // 쿼리가 #태그 형식인지 여부 (UI 힌트용)
  const isHashtagSearch = query.trim().startsWith('#')

  return { query, setQuery, results, searching, isHashtagSearch }
}
