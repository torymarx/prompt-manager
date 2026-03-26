'use client'

import { useState, useEffect } from 'react'
import { Trash2, Heart, ThumbsUp, Smile, Frown, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Comment, CommentReaction } from '@/lib/types'

interface CommentItemProps {
  comment: Comment
  onDelete: (id: string) => Promise<any>
  onToggleReaction: (commentId: string, emoji: string) => Promise<any>
}

const EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '🔥']

export function CommentItem({ comment, onDelete, onToggleReaction }: CommentItemProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [supabase])

  const isAuthor = currentUserId === comment.user_id
  
  // 반응 그룹화 (emoji별 개수 및 내가 클릭했는지 여부)
  const reactionGroups = (comment.reactions || []).reduce((acc, curr) => {
    if (!acc[curr.emoji]) acc[curr.emoji] = { count: 0, me: false }
    acc[curr.emoji].count++
    if (curr.user_id === currentUserId) acc[curr.emoji].me = true
    return acc
  }, {} as Record<string, { count: number; me: boolean }>)

  return (
    <div className="group flex flex-col gap-2 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary/80 truncate">
              {comment.user_email || '사용자'} 
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(comment.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {comment.content}
          </div>

          {comment.image_url && (
            <div className="mt-2 relative inline-block max-w-[200px] overflow-hidden rounded-lg border bg-black/5">
              <img src={comment.image_url} alt="댓글 이미지" className="w-full h-auto object-contain cursor-zoom-in" />
            </div>
          )}
        </div>

        {isAuthor && (
          <button
            onClick={() => onDelete(comment.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
            title="댓글 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 반응 섹션 */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        {Object.entries(reactionGroups).map(([emoji, { count, me }]) => (
          <button
            key={emoji}
            onClick={() => onToggleReaction(comment.id, emoji)}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all border",
              me 
                ? "bg-primary/10 border-primary/30 text-primary font-medium" 
                : "bg-muted/50 border-transparent hover:border-muted-foreground/30 text-muted-foreground"
            )}
          >
            <span>{emoji}</span>
            <span className="text-[10px]">{count}</span>
          </button>
        ))}
        
        {/* 새로운 반응 추가 버튼 (더보기/Hover 시) */}
        <div className="relative group/emoji-picker">
          <button className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/30 hover:bg-muted text-muted-foreground transition-colors ml-1">
            <Smile className="w-3.5 h-3.5" />
          </button>
          
          {/* 간이 이모지 피커 */}
          <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-full bg-background border shadow-xl flex gap-1 opacity-0 pointer-events-none group-hover/emoji-picker:opacity-100 group-hover/emoji-picker:pointer-events-auto transition-all z-10">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(comment.id, emoji)}
                className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded-full transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
