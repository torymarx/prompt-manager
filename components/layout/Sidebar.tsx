'use client'

// 좌측 사이드바 - 접기/펼치기 지원 + 폴더 트리 + 모바일 드로어 지원
import { BrainCircuit, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { FolderTree } from '@/components/folders/FolderTree'
import { HelpModal } from '@/components/layout/HelpModal'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  selectedFolderId: string | null
  onSelectFolder: (id: string | null, type?: 'prompt' | 'website') => void
  collapsed: boolean
  onToggleCollapse: () => void
  onCloseMobile?: () => void
}

export function Sidebar({ selectedFolderId, onSelectFolder, collapsed, onToggleCollapse, onCloseMobile }: SidebarProps) {
  return (
    <aside className={cn(
      'relative flex flex-col border-r bg-card shrink-0 transition-all duration-200 h-full',
      // 데스크탑: 접기 여부에 따라 너비 변경
      // 모바일: 항상 전체 너비(드로어)
      collapsed ? 'md:w-12 w-72' : 'w-72 md:w-64'
    )}>
      {/* 로고 + 모바일 닫기 버튼 */}
      <div className={cn(
        'flex items-center border-b shrink-0',
        collapsed ? 'md:justify-center md:px-2 px-4 py-4' : 'gap-2.5 px-4 py-4'
      )}>
        {/* 데스크탑 접힌 상태가 아닐 때 또는 모바일일 때 로고 표시 */}
        <div className={cn(
          'flex items-center gap-2.5 flex-1 min-w-0',
          collapsed && 'md:justify-center'
        )}>
          <div className="flex items-center justify-center w-14 h-14 shrink-0 overflow-hidden relative">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="absolute w-[280%] h-[280%] object-contain scale-[1.0] translate-y-[-18%]" 
            />
          </div>
          <span className={cn(
            'font-bold text-sm truncate',
            collapsed && 'md:hidden'
          )}>
            프롬프트 매니저
          </span>
        </div>

        {/* 모바일에서만 보이는 닫기 버튼 */}
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

      {/* 폴더 트리 (데스크탑 접힌 상태에서는 숨김) */}
      <ScrollArea className={cn(
        'flex-1',
        collapsed && 'md:hidden'
      )}>
        <FolderTree
          selectedFolderId={selectedFolderId}
          onSelect={onSelectFolder}
        />
      </ScrollArea>

      {/* 하단 저작권 + 도움말 (데스크탑 접힌 상태에서는 숨김) */}
      <div className={cn(
        'shrink-0 border-t px-3 py-2 flex items-center justify-between',
        collapsed && 'md:hidden'
      )}>
        <p className="text-[10px] text-muted-foreground leading-tight">
          © {new Date().getFullYear()} Naku Lab Studio <span className="opacity-50">v3.4.0</span>
        </p>
        <HelpModal />
      </div>

      {/* 접기/펼치기 버튼 (데스크탑에서만 표시) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className={cn(
          'hidden md:flex absolute -right-3.5 top-14 z-10 h-7 w-7 rounded-full border bg-background shadow-sm',
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
