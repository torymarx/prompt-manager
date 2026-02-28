'use client'

// 프롬프트 목록 컴포넌트 - 그리드/리스트 전환, CRUD 모달 통합
import { useState, useMemo } from 'react'
import { Plus, LayoutGrid, List, Inbox, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { PromptCard } from './PromptCard'
import { PromptEditor } from './PromptEditor'
import { usePrompts } from '@/lib/hooks/usePrompts'
import { useFolders } from '@/lib/hooks/useFolders'
import type { Prompt, ViewMode } from '@/lib/types'

// 복사 후 클립보드 에러 알림
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

interface PromptListProps {
  folderIds?: string[]       // undefined = 전체, array = 해당 폴더+하위 포함
  folderName: string
  searchQuery?: string
  searchResults?: Prompt[]
  isSearching?: boolean
}

export function PromptList({
  folderIds, folderName, searchQuery, searchResults, isSearching
}: PromptListProps) {
  const { prompts, loading, createPrompt, updatePrompt, deletePrompt, toggleShare } = usePrompts(
    // 검색 중이면 undefined(전체 조회), 아니면 folderIds 전달
    searchQuery ? undefined : folderIds
  )
  const { folders } = useFolders()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Prompt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 표시할 프롬프트: 검색 중이면 검색 결과, 아니면 폴더 내 목록
  const basePrompts = searchQuery ? (searchResults || []) : prompts

  // 태그 필터 적용
  const displayPrompts = useMemo(() => {
    if (selectedTags.length === 0) return basePrompts
    return basePrompts.filter((p) =>
      selectedTags.every((tag) => p.tags.includes(tag))
    )
  }, [basePrompts, selectedTags])

  // 현재 목록에서 모든 태그 수집
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    basePrompts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [basePrompts])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

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

  // 공유 시작 또는 링크 복사
  const handleShare = async (prompt: Prompt) => {
    if (prompt.is_public && prompt.share_token) {
      const url = `${window.location.origin}/share/${prompt.share_token}`
      const ok = await copyToClipboard(url)
      if (ok) {
        toast.success('공유 링크가 클립보드에 복사되었습니다.')
      } else {
        toast.error('링크 복사에 실패했습니다. 브라우저 권한을 확인해주세요.')
      }
    } else {
      const token = await toggleShare(prompt.id, true)
      if (token) {
        const url = `${window.location.origin}/share/${token}`
        const ok = await copyToClipboard(url)
        if (ok) {
          toast.success('공유가 시작되었습니다. 링크가 클립보드에 복사되었습니다.')
        } else {
          toast.success('공유가 시작되었습니다.', { description: url })
        }
      }
    }
  }

  // 공유 중지
  const handleStopShare = async (prompt: Prompt) => {
    await toggleShare(prompt.id, false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex flex-col border-b shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {searchQuery ? `"${searchQuery}" 검색 결과` : folderName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayPrompts.length}개의 프롬프트
              {selectedTags.length > 0 && (
                <span className="ml-1 text-primary">
                  (태그 필터: {selectedTags.join(', ')})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* 뷰 전환 */}
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-none h-8 w-8"
                onClick={() => setViewMode('grid')}
                title="그리드 뷰"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-none h-8 w-8"
                onClick={() => setViewMode('list')}
                title="리스트 뷰"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* 새 프롬프트 */}
            <Button
              size="sm"
              onClick={() => { setEditTarget(null); setEditorOpen(true) }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              새 프롬프트
            </Button>
          </div>
        </div>

        {/* 태그 필터 바 */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-2 px-6 pb-3 flex-wrap">
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" /> 초기화
              </button>
            )}
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer select-none text-xs hover:bg-primary/10 transition-colors"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading && !searchQuery ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">검색 중...</span>
          </div>
        ) : displayPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <Inbox className="w-10 h-10" />
            <p className="text-sm">
              {searchQuery ? '검색 결과가 없습니다.' : '프롬프트가 없습니다.'}
            </p>
            {!searchQuery && (
              <Button size="sm" variant="outline" onClick={() => { setEditTarget(null); setEditorOpen(true) }}>
                <Plus className="w-4 h-4 mr-1" /> 첫 프롬프트 만들기
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
            {displayPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                viewMode="grid"
                searchQuery={searchQuery}
                onEdit={(p) => { setEditTarget(p); setEditorOpen(true) }}
                onDelete={setDeleteTarget}
                onShare={handleShare}
                onStopShare={handleStopShare}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y">
            {displayPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                viewMode="list"
                searchQuery={searchQuery}
                onEdit={(p) => { setEditTarget(p); setEditorOpen(true) }}
                onDelete={setDeleteTarget}
                onShare={handleShare}
                onStopShare={handleStopShare}
              />
            ))}
          </div>
        )}
      </div>

      {/* 에디터 모달 */}
      <PromptEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        folders={folders}
        currentFolderId={folderIds?.[0] ?? null}
        editTarget={editTarget}
      />

      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>프롬프트 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.title}</span>를
            삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
