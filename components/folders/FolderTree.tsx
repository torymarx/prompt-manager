'use client'

// 전체 폴더 트리 컴포넌트 - CRUD 모달 포함 + 폴더 타입(프롬프트/웹사이트) 선택
import { useState, useEffect, useRef } from 'react'
import { FolderPlus, Home, Folder, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FolderNode } from './FolderNode'
import { useFolders } from '@/lib/hooks/useFolders'
import { usePromptCounts } from '@/lib/hooks/usePromptCounts'
import { cn } from '@/lib/utils'
import type { Folder as FolderType } from '@/lib/types'

interface FolderTreeProps {
  selectedFolderId: string | null
  onSelect: (id: string | null, type?: 'prompt' | 'website') => void
}

type ModalState =
  | { type: 'create'; parentId: string | null }
  | { type: 'rename'; folder: FolderType }
  | { type: 'delete'; folder: FolderType }
  | null

export function FolderTree({ selectedFolderId, onSelect }: FolderTreeProps) {
  const { folders, tree, loading, createFolder, renameFolder, deleteFolder } = useFolders()
  const directCounts = usePromptCounts()
  const [modal, setModal] = useState<ModalState>(null)
  const [inputValue, setInputValue] = useState('')
  const [newFolderType, setNewFolderType] = useState<'prompt' | 'website'>('prompt')
  const initDone = useRef(false)

  // 북마크(웹사이트) 폴더가 없으면 자동 생성
  useEffect(() => {
    if (loading || initDone.current) return
    initDone.current = true
    if (!folders.some((f) => f.folder_type === 'website')) {
      createFolder('북마크', null, 'website')
    }
  }, [loading, folders])

  const openCreate = (parentId: string | null) => {
    setInputValue('')
    setNewFolderType('prompt')
    setModal({ type: 'create', parentId })
  }

  const openRename = (folder: FolderType) => {
    setInputValue(folder.name)
    setModal({ type: 'rename', folder })
  }

  const handleConfirm = async () => {
    if (!modal) return
    if (modal.type === 'create' && inputValue.trim()) {
      await createFolder(inputValue.trim(), modal.parentId, newFolderType)
    } else if (modal.type === 'rename' && inputValue.trim()) {
      await renameFolder(modal.folder.id, inputValue.trim())
    } else if (modal.type === 'delete') {
      await deleteFolder(modal.folder.id)
      if (selectedFolderId === modal.folder.id) onSelect(null)
    }
    setModal(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-2 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          폴더
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCreate(null)} title="최상위 폴더 만들기">
          <FolderPlus className="w-4 h-4" />
        </Button>
      </div>

      {/* 전체 보기 (루트) */}
      <div className="px-2 pt-2">
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            selectedFolderId === null && 'bg-accent text-accent-foreground font-medium'
          )}
          onClick={() => onSelect(null)}
        >
          <Home className="w-4 h-4" />
          <span>전체 프롬프트</span>
        </div>
      </div>

      {/* 폴더 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {loading ? (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">불러오는 중...</p>
        ) : tree.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">
            폴더가 없습니다.<br />
            위 + 버튼으로 만들어보세요.
          </p>
        ) : (
          tree.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              depth={0}
              selectedId={selectedFolderId}
              directCounts={directCounts}
              onSelect={onSelect}
              onCreateChild={openCreate}
              onRename={openRename}
              onDelete={(f) => setModal({ type: 'delete', folder: f })}
            />
          ))
        )}
      </div>

      {/* 폴더 생성/이름변경 모달 */}
      <Dialog open={modal?.type === 'create' || modal?.type === 'rename'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {modal?.type === 'create' ? '새 폴더 만들기' : '폴더 이름 변경'}
            </DialogTitle>
          </DialogHeader>

          {/* 폴더 타입 선택 (생성 시에만) */}
          {modal?.type === 'create' && (
            <div className="flex rounded-lg border overflow-hidden">
              <button
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors',
                  newFolderType === 'prompt'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-muted-foreground'
                )}
                onClick={() => setNewFolderType('prompt')}
              >
                <Folder className="w-4 h-4" />
                프롬프트 폴더
              </button>
              <button
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors border-l',
                  newFolderType === 'website'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-muted-foreground'
                )}
                onClick={() => setNewFolderType('website')}
              >
                <Globe className="w-4 h-4" />
                웹사이트 폴더
              </button>
            </div>
          )}

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="폴더 이름"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>취소</Button>
            <Button onClick={handleConfirm} disabled={!inputValue.trim()}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={modal?.type === 'delete'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>폴더 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {modal?.type === 'delete' && modal.folder.name}
            </span> 폴더를 삭제하시겠습니까?<br />
            하위 폴더도 함께 삭제되며, 프롬프트는 미분류로 이동합니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>취소</Button>
            <Button variant="destructive" onClick={handleConfirm}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
