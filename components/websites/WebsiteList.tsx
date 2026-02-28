'use client'

// 웹사이트 북마크 목록 - 그리드 뷰 전용
import { useState } from 'react'
import { Plus, Loader2, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { WebsiteCard } from './WebsiteCard'
import { WebsiteEditor } from './WebsiteEditor'
import { usePrompts } from '@/lib/hooks/usePrompts'
import type { Prompt } from '@/lib/types'

interface WebsiteListProps {
  folderIds?: string[]
  folderName: string
}

export function WebsiteList({ folderIds, folderName }: WebsiteListProps) {
  const { prompts: websites, loading, createPrompt, updatePrompt, deletePrompt } = usePrompts(folderIds)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Prompt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null)

  const handleSave = async (values: Omit<Prompt, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editTarget) {
      await updatePrompt(editTarget.id, values)
    } else {
      await createPrompt(values)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deletePrompt(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{folderName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{websites.length}개의 링크</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditTarget(null); setEditorOpen(true) }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> 새 링크 추가
        </Button>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : websites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <Inbox className="w-10 h-10" />
            <p className="text-sm">저장된 링크가 없습니다.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditTarget(null); setEditorOpen(true) }}
            >
              <Plus className="w-4 h-4 mr-1" /> 첫 링크 추가
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 p-6">
            {websites.map((website) => (
              <WebsiteCard
                key={website.id}
                website={website}
                onEdit={(w) => { setEditTarget(w); setEditorOpen(true) }}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* 에디터 모달 */}
      <WebsiteEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        currentFolderId={folderIds?.[0] ?? null}
        editTarget={editTarget}
      />

      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>링크 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.title}</span>를
            삭제하시겠습니까?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
