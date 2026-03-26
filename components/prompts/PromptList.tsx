'use client'

// 프롬프트 목록 컴포넌트 - 그리드/리스트 전환, CRUD 모달 통합, 순서 정렬
import { useState, useMemo } from 'react'
import { Plus, LayoutGrid, List, Inbox, Loader2, Globe, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { arrayMove } from '@dnd-kit/sortable'
import { PromptCard } from './PromptCard'
import { PromptEditor } from './PromptEditor'
import { WebsiteEditor } from '../websites/WebsiteEditor'
import { usePrompts } from '@/lib/hooks/usePrompts'
import { useFolders } from '@/lib/hooks/useFolders'
import { useCommentCounts } from '@/lib/hooks/useCommentCounts'
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
  const { prompts, loading, createPrompt, updatePrompt, deletePrompt, toggleShare, reorderPrompts } = usePrompts(
    // 검색 중이면 undefined(전체 조회), 아니면 folderIds 전달
    searchQuery ? undefined : folderIds
  )
  const { folders } = useFolders()
  const commentCounts = useCommentCounts()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [editorOpen, setEditorOpen] = useState(false)
  const [websiteEditorOpen, setWebsiteEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Prompt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null)
  // 표시할 프롬프트: 검색 중이면 검색 결과, 아니면 폴더 내 목록
  // 전체 보기(folderIds 없음)일 때 폴더 우선순위 정렬: 인물/그림 → 상단, 지침/북마크/유튜브 → 하단
  const displayPrompts = useMemo(() => {
    const raw = searchQuery ? (searchResults || []) : prompts
    // 특정 폴더 선택 시 또는 검색 중이면 기존 정렬 유지
    if (folderIds || searchQuery) return raw

    // 전체 보기: 폴더 이름 기반 우선순위 정렬
    const HIGH_PRIORITY = ['인물', '그림']               // 상단 고정
    const LOW_PRIORITY = ['지침프롬프트', '북마크', 'youtube', 'YOUTUBE']  // 하단 고정

    const getFolderPriority = (folderId: string | null): number => {
      if (!folderId) return 1
      const folder = folders.find(f => f.id === folderId)
      if (!folder) return 1
      const name = folder.name.toLowerCase()
      if (HIGH_PRIORITY.some(n => name.includes(n.toLowerCase()))) return 0
      if (LOW_PRIORITY.some(n => name.includes(n.toLowerCase()))) return 2
      return 1
    }

    return [...raw].sort((a, b) => {
      const pa = getFolderPriority(a.folder_id)
      const pb = getFolderPriority(b.folder_id)
      if (pa !== pb) return pa - pb
      return 0 // 같은 우선순위면 기존 순서 유지
    })
  }, [searchQuery, searchResults, prompts, folderIds, folders])

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

  const handleMoveUp = (prompt: Prompt) => {
    const idx = displayPrompts.findIndex((p) => p.id === prompt.id)
    if (idx <= 0) return
    reorderPrompts(arrayMove([...displayPrompts], idx, idx - 1))
  }

  const handleMoveDown = (prompt: Prompt) => {
    const idx = displayPrompts.findIndex((p) => p.id === prompt.id)
    if (idx >= displayPrompts.length - 1) return
    reorderPrompts(arrayMove([...displayPrompts], idx, idx + 1))
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex flex-col border-b shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold truncate">
              {searchQuery ? `"${searchQuery}" 검색 결과` : folderName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayPrompts.length}개의 프롬프트
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 뷰 전환 */}
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-none h-9 w-9 sm:h-8 sm:w-8"
                onClick={() => setViewMode('grid')}
                title="그리드 뷰"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-none h-9 w-9 sm:h-8 sm:w-8"
                onClick={() => setViewMode('list')}
                title="리스트 뷰"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* 추가 드롭다운 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="gap-1.5 h-9 sm:h-8 px-3 text-sm shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>추가</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => { setEditTarget(null); setEditorOpen(true) }}>
                  <FileText className="w-4 h-4 mr-2" /> 새 프롬프트
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditTarget(null); setWebsiteEditorOpen(true) }}>
                  <Globe className="w-4 h-4 mr-2" /> 북마크
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
            {displayPrompts.map((prompt, idx) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                viewMode="grid"
                searchQuery={searchQuery}
                onMoveUp={!searchQuery && idx > 0 ? () => handleMoveUp(prompt) : undefined}
                onMoveDown={!searchQuery && idx < displayPrompts.length - 1 ? () => handleMoveDown(prompt) : undefined}
                onEdit={(p) => { setEditTarget(p); setEditorOpen(true) }}
                onDelete={setDeleteTarget}
                onShare={handleShare}
                onStopShare={handleStopShare}
                commentCount={commentCounts[prompt.id]}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y">
            {displayPrompts.map((prompt, idx) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                viewMode="list"
                searchQuery={searchQuery}
                onMoveUp={!searchQuery && idx > 0 ? () => handleMoveUp(prompt) : undefined}
                onMoveDown={!searchQuery && idx < displayPrompts.length - 1 ? () => handleMoveDown(prompt) : undefined}
                onEdit={(p) => { setEditTarget(p); setEditorOpen(true) }}
                onDelete={setDeleteTarget}
                onShare={handleShare}
                onStopShare={handleStopShare}
                commentCount={commentCounts[prompt.id]}
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

      {/* 북마크 에디터 추가 (어디서나 링크 등록 가능하게) */}
      <WebsiteEditor
        open={websiteEditorOpen}
        onClose={() => setWebsiteEditorOpen(false)}
        onSave={handleSave}
        currentFolderId={folderIds?.[0] ?? null}
        editTarget={null}
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
