'use client'

// 단일 폴더 노드 - 재귀적으로 하위 폴더를 렌더링
import { useState } from 'react'
import { ChevronRight, ChevronUp, ChevronDown, Folder, FolderOpen, Globe, MoreHorizontal, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Folder as FolderType } from '@/lib/types'

interface FolderNodeProps {
  folder: FolderType
  depth: number
  selectedId: string | null
  directCounts: Record<string, number>
  onSelect: (id: string, type: 'prompt' | 'website') => void
  onCreateChild: (parentId: string) => void
  onRename: (folder: FolderType) => void
  onDelete: (folder: FolderType) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onReorder: (siblings: FolderType[]) => Promise<void>
}

/** 해당 폴더 + 모든 하위 폴더의 프롬프트 수 합산 */
function getTotalCount(folder: FolderType, directCounts: Record<string, number>): number {
  const own = directCounts[folder.id] ?? 0
  const childTotal = (folder.children ?? []).reduce(
    (sum, child) => sum + getTotalCount(child, directCounts), 0
  )
  return own + childTotal
}

export function FolderNode({
  folder, depth, selectedId, directCounts, onSelect,
  onCreateChild, onRename, onDelete, onMoveUp, onMoveDown, onReorder
}: FolderNodeProps) {
  const [open, setOpen] = useState(false)
  const hasChildren = folder.children && folder.children.length > 0
  const isSelected = selectedId === folder.id
  const totalCount = getTotalCount(folder, directCounts)

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-all relative overflow-hidden',
          'hover:bg-accent/50 hover:text-accent-foreground',
          isSelected
            ? 'bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary/20'
            : 'text-muted-foreground'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(folder.id, folder.folder_type)}
      >
        {/* 펼치기/접기 화살표 */}
        <button
          className="p-0.5 rounded hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        >
          <ChevronRight
            className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-90')}
          />
        </button>

        {/* 폴더 아이콘 - 웹사이트 폴더는 Globe, 프롬프트 폴더는 Folder */}
        {folder.folder_type === 'website' ? (
          <Globe className="w-4 h-4 text-blue-500 shrink-0" />
        ) : open ? (
          <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-500 shrink-0" />
        )}

        {/* 폴더 이름 */}
        <span className="flex-1 truncate">{folder.name}</span>

        {/* 프롬프트 수 뱃지 */}
        {totalCount > 0 && (
          <span className={cn(
            'shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium',
            isSelected
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground group-hover:bg-accent-foreground/10'
          )}>
            {totalCount}
          </span>
        )}

        {/* 컨텍스트 메뉴 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => { onCreateChild(folder.id); setOpen(true) }}>
              <FolderPlus className="w-4 h-4 mr-2" />
              하위 폴더 만들기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="w-4 h-4 mr-2" />
              이름 변경
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!onMoveUp} onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}>
              <ChevronUp className="w-4 h-4 mr-2" />
              위로 이동
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!onMoveDown} onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}>
              <ChevronDown className="w-4 h-4 mr-2" />
              아래로 이동
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(folder)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 하위 폴더 재귀 렌더링 */}
      {open && hasChildren && (
        <div>
          {folder.children!.map((child, cidx) => {
            const siblings = folder.children!
            return (
              <FolderNode
                key={child.id}
                folder={child}
                depth={depth + 1}
                selectedId={selectedId}
                directCounts={directCounts}
                onSelect={onSelect as (id: string, type: 'prompt' | 'website') => void}
                onCreateChild={onCreateChild}
                onRename={onRename}
                onDelete={onDelete}
                onMoveUp={cidx > 0 ? () => {
                  const next = [...siblings]
                  ;[next[cidx - 1], next[cidx]] = [next[cidx], next[cidx - 1]]
                  onReorder(next)
                } : undefined}
                onMoveDown={cidx < siblings.length - 1 ? () => {
                  const next = [...siblings]
                  ;[next[cidx], next[cidx + 1]] = [next[cidx + 1], next[cidx]]
                  onReorder(next)
                } : undefined}
                onReorder={onReorder}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
