'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Comment, CommentReaction } from '@/lib/types'

export function useComments(promptId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchComments = useCallback(async () => {
    setLoading(true)
    // 댓글과 해당 댓글의 반응들을 함께 가져옴
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        reactions:comment_reactions(*)
      `)
      .eq('prompt_id', promptId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Fetch comments error:', error)
      toast.error('댓글을 불러오는 데 실패했습니다.')
    } else {
      setComments(data || [])
    }
    setLoading(false)
  }, [promptId, supabase])

  useEffect(() => {
    fetchComments()

    // 실시간 구독 설정 - DELETE 시 필터 누락 문제로 인해 로컬 필터링 사용
    const channel = supabase
      .channel(`comments:${promptId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          // DELETE 이벤트의 경우 old 레코드에 prompt_id가 없을 수 있으므로 
          // 현재 promptId와 상관없이 refetch하거나, payload 확인 로직 추가
          if (payload.eventType === 'DELETE' || 
             (payload.new as Comment)?.prompt_id === promptId || 
             (payload.old as Comment)?.prompt_id === promptId) {
            fetchComments()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_reactions' },
        () => fetchComments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [promptId, fetchComments, supabase])

  // 댓글 작성
  const addComment = async (content: string, imageUrl: string | null = null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('로그인이 필요합니다.')
      return null
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        prompt_id: promptId,
        user_id: user.id,
        content,
        image_url: imageUrl
      })
      .select()
      .single()

    if (error) {
      toast.error('댓글 작성에 실패했습니다.')
      return null
    }

    // 작성 후 즉시 fetch (실시간이 느릴 수 있으므로)
    fetchComments()
    return data
  }

  // 댓글 삭제
  const deleteComment = async (commentId: string) => {
    // 낙관적 업데이트: UI에서 먼저 제거
    setComments(prev => prev.filter(c => c.id !== commentId))

    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) {
      toast.error('댓글 삭제에 실패했습니다.')
      fetchComments() // 실패 시 원래 데이터로 복구
      return false
    }
    toast.success('댓글이 삭제되었습니다.')
    return true
  }

  // 반응(이모지) 토글
  const toggleReaction = async (commentId: string, emoji: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('로그인이 필요합니다.')
      return
    }

    // 낙관적 업데이트 로직 (간단히 UI를 위함)
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c
      const reactions = c.reactions || []
      const existingIdx = reactions.findIndex(r => r.user_id === user.id && r.emoji === emoji)
      
      if (existingIdx > -1) {
        return { ...c, reactions: reactions.filter((_, i) => i !== existingIdx) }
      } else {
        return { ...c, reactions: [...reactions, { id: 'temp', comment_id: commentId, user_id: user.id, emoji }] }
      }
    }))

    // 이미 해당 이모지로 반응했는지 확인
    const { data: existing } = await supabase
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .single()

    if (existing) {
      await supabase.from('comment_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('comment_reactions').insert({
        comment_id: commentId,
        user_id: user.id,
        emoji
      })
    }
    // 실제 DB 반영 후 refetch (안정성)
    fetchComments()
  }

  return {
    comments,
    loading,
    addComment,
    deleteComment,
    toggleReaction,
    refetch: fetchComments
  }
}
