'use client'

// 좌측 사이드바 - 접기/펼치기 지원 + 폴더 트리
import { BrainCircuit, ChevronLeft, ChevronRight } from 'lucide-react'
import { FolderTree } from '@/components/folders/FolderTree'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ selectedFolderId, onSelectFolder, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside className={cn(
      'relative flex flex-col border-r bg-card shrink-0 transition-all duration-200',
      collapsed ? 'w-12' : 'w-64'
    )}>
      {/* 로고 */}
      <div className={cn(
        'flex items-center border-b shrink-0',
        collapsed ? 'justify-center px-2 py-4' : 'gap-2.5 px-4 py-4'
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <BrainCircuit className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm truncate">프롬프트 매니저</span>
        )}
      </div>

      {/* 폴더 트리 (접혔을 때 숨김) */}
      {!collapsed && (
        <ScrollArea className="flex-1">
          <FolderTree
            selectedFolderId={selectedFolderId}
            onSelect={onSelectFolder}
          />
        </ScrollArea>
      )}

      {/* 접기/펼치기 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className={cn(
          'absolute -right-3.5 top-14 z-10 h-7 w-7 rounded-full border bg-background shadow-sm',
          'hover:bg-accent transition-colors'
        )}
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
