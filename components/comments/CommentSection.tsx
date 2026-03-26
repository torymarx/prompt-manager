'use client'

import { useComments } from '@/lib/hooks/useComments'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import { Loader2, MessageSquare } from 'lucide-react'

interface CommentSectionProps {
  promptId: string
}

export function CommentSection({ promptId }: CommentSectionProps) {
  const { comments, loading, addComment, deleteComment, toggleReaction } = useComments(promptId)

  return (
    <div className="flex flex-col gap-6 w-full py-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <MessageSquare className="w-5 h-5 text-primary/70" />
        <h3 className="font-semibold text-base">댓글 ({comments.length})</h3>
      </div>

      {/* 댓글 작성 폼 */}
      <CommentForm onSave={addComment} />

      {/* 댓글 목록 */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>댓글을 불러오는 중...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
            <MessageSquare className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-sm">첫 댓글을 남겨보세요!</p>
          </div>
        ) : (
          <div className="grid gap-3 overflow-hidden">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onDelete={deleteComment}
                onToggleReaction={toggleReaction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
