'use client'

// 전체 공유 뷰어 - 읽기 전용 대시보드 스타일
// 추가/수정/삭제/공유 불가, 폴더 탐색·검색·복사만 가능
import { useState, useMemo, useRef } from 'react'
import {
  LayoutGrid, List, Inbox, Clock, BrainCircuit,
  ChevronRight, Folder as FolderIcon, FolderOpen,
  ChevronLeft, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PromptCard } from '@/components/prompts/PromptCard'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { buildFolderTree, getDescendantIds } from '@/lib/hooks/useFolders'
import { cn } from '@/lib/utils'
import type { Prompt, Folder, ViewMode } from '@/lib/types'

// ── 읽기 전용 폴더 노드 ──────────────────────────────────────────────────────

function ReadOnlyFolderNode({
  folder, selectedFolderId, onSelect, allFolders, depth,
}: {
  folder: Folder
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
  allFolders: Folder[]
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = (folder.children?.length ?? 0) > 0
  const isSelected = folder.id === selectedFolderId

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-sm select-none',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-accent/50 text-foreground'
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {/* 접기/펼치기 버튼 */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? '접기' : '펼치기'}
          >
            <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {isSelected
          ? <FolderOpen className="w-4 h-4 shrink-0 text-primary" />
          : <FolderIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
        }
        <span className="truncate">{folder.name}</span>
      </div>

      {expanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <ReadOnlyFolderNode
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              allFolders={allFolders}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 읽기 전용 사이드바 ────────────────────────────────────────────────────────

function ReadOnlySidebar({
  folders, tree, selectedFolderId, onSelect, collapsed, onToggleCollapse, onCloseMobile,
}: {
  folders: Folder[]
  tree: Folder[]
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
  collapsed: boolean
  onToggleCollapse: () => void
  onCloseMobile?: () => void
}) {
  return (
    <aside className={cn(
      'relative flex flex-col border-r bg-card shrink-0 transition-all duration-200 h-full',
      collapsed ? 'md:w-12 w-72' : 'w-72 md:w-64'
    )}>
      {/* 로고 + 모바일 닫기 */}
      <div className={cn(
        'flex items-center border-b shrink-0',
        collapsed ? 'md:justify-center md:px-2 px-4 py-4' : 'gap-2.5 px-4 py-4'
      )}>
        <div className={cn(
          'flex items-center gap-2.5 flex-1 min-w-0',
          collapsed && 'md:justify-center'
        )}>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
            <BrainCircuit className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className={cn('font-bold text-sm truncate', collapsed && 'md:hidden')}>
            프롬프트 매니저
          </span>
        </div>
        {onCloseMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            className="md:hidden h-10 w-10 shrink-0"
            aria-label="사이드바 닫기"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* 폴더 트리 */}
      <ScrollArea className={cn('flex-1 p-2', collapsed && 'md:hidden')}>
        {/* 전체 */}
        <button
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors mb-1',
            selectedFolderId === null
              ? 'bg-primary/10 text-primary font-medium'
              : 'hover:bg-accent/50 text-foreground'
          )}
          onClick={() => onSelect(null)}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          전체 프롬프트
        </button>

        {tree.map((folder) => (
          <ReadOnlyFolderNode
            key={folder.id}
            folder={folder}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            allFolders={folders}
            depth={0}
          />
        ))}
      </ScrollArea>

      {/* 하단 */}
      <div className={cn(
        'shrink-0 border-t px-3 py-2',
        collapsed && 'md:hidden'
      )}>
        <p className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} Naku Lab Studio
        </p>
      </div>

      {/* 접기/펼치기 버튼 (데스크탑) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="hidden md:flex absolute -right-3.5 top-14 z-10 h-7 w-7 rounded-full border bg-background shadow-sm hover:bg-accent"
        title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronLeft className="w-3.5 h-3.5" />
        }
      </Button>
    </aside>
  )
}

// ── 메인 뷰어 ────────────────────────────────────────────────────────────────

interface CollectionViewerClientProps {
  prompts: Prompt[]
  folders: Folder[]
  expiresLabel: string
}

export function CollectionViewerClient({ prompts, folders, expiresLabel }: CollectionViewerClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [query, setQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // 스와이프로 사이드바 열기 (모바일)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (touchStartX.current < 30 && deltaX > 50 && deltaY < deltaX) {
      setMobileSidebarOpen(true)
    }
    if (mobileSidebarOpen && deltaX < -60 && deltaY < Math.abs(deltaX)) {
      setMobileSidebarOpen(false)
    }
  }

  // 폴더 트리 구성
  const tree = useMemo(() => buildFolderTree(folders), [folders])

  // 선택된 폴더 + 하위 폴더 ID 목록
  const activeFolderIds = useMemo<string[] | undefined>(() => {
    if (!selectedFolderId) return undefined
    return [selectedFolderId, ...getDescendantIds(selectedFolderId, folders)]
  }, [selectedFolderId, folders])

  // 브레드크럼
  const breadcrumb = useMemo(() => {
    if (!selectedFolderId) return []
    const crumbs: string[] = []
    let currentId: string | null = selectedFolderId
    const visited = new Set<string>()
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const f = folders.find((x) => x.id === currentId)
      if (!f) break
      crumbs.unshift(f.name)
      currentId = f.parent_id ?? null
    }
    return crumbs
  }, [selectedFolderId, folders])

  // 폴더 필터 + 클라이언트 사이드 검색
  const displayPrompts = useMemo(() => {
    // 1) 폴더 필터
    let filtered = activeFolderIds
      ? prompts.filter((p) => activeFolderIds.includes(p.folder_id ?? ''))
      : prompts

    // 2) 검색 필터
    const trimmed = query.trim().toLowerCase()
    if (trimmed) {
      if (trimmed.startsWith('#')) {
        const tagKeyword = trimmed.slice(1)
        filtered = filtered.filter((p) =>
          p.tags.some((t) => t.toLowerCase().includes(tagKeyword))
        )
      } else {
        filtered = filtered.filter((p) =>
          p.title.toLowerCase().includes(trimmed) ||
          p.content.toLowerCase().includes(trimmed) ||
          p.tags.some((t) => t.toLowerCase().includes(trimmed))
        )
      }
    }

    return filtered
  }, [prompts, activeFolderIds, query])

  const folderName = selectedFolderId
    ? (folders.find((f) => f.id === selectedFolderId)?.name ?? '폴더')
    : '전체 프롬프트'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 모바일 오버레이 */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-40 md:relative md:z-auto',
        'transition-transform duration-300 ease-in-out',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0'
      )}>
        <ReadOnlySidebar
          folders={folders}
          tree={tree}
          selectedFolderId={selectedFolderId}
          onSelect={(id) => { setSelectedFolderId(id); setMobileSidebarOpen(false) }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* 우측 메인 영역 */}
      <div
        className="flex flex-col flex-1 overflow-hidden min-w-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 헤더 */}
        <header className="flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
          {/* 모바일: 로고 버튼으로 사이드바 열기 */}
          <button
            className="md:hidden shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary active:opacity-80"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="메뉴 열기"
          >
            <BrainCircuit className="w-4 h-4 text-primary-foreground" />
          </button>

          {/* 브레드크럼 */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0 flex-1">
            <button
              onClick={() => setSelectedFolderId(null)}
              className="hover:text-foreground transition-colors shrink-0 font-medium min-h-[36px] px-1 flex items-center"
            >
              전체
            </button>
            {breadcrumb.map((name, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className={i === breadcrumb.length - 1 ? 'text-foreground font-medium truncate' : 'truncate'}>
                  {name}
                </span>
              </span>
            ))}
          </div>

          {/* 검색 + 액션 */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <input
              type="text"
              placeholder="검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-28 sm:w-48 h-9 px-3 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
            {/* 만료 정보 */}
            <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              <span>만료: {expiresLabel}</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* 컨텐츠 헤더 */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold truncate">
              {query.trim() ? `"${query.trim()}" 검색 결과` : folderName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayPrompts.length}개의 프롬프트
            </p>
          </div>
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
        </div>

        {/* 프롬프트 목록 */}
        <main className="flex-1 overflow-y-auto">
          {displayPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <Inbox className="w-10 h-10" />
              <p className="text-sm">
                {query.trim() ? '검색 결과가 없습니다.' : '프롬프트가 없습니다.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6">
              {displayPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  viewMode="grid"
                  readOnly
                  searchQuery={query.trim() || undefined}
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
                  readOnly
                  searchQuery={query.trim() || undefined}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
