'use client'

import { Home, Folder, Search, User, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  activeTab: 'all' | 'folders' | 'search' | 'profile' | 'websites'
  onTabChange: (tab: 'all' | 'folders' | 'search' | 'profile' | 'websites') => void
  onOpenSidebar: () => void
}

export function BottomNav({ activeTab, onTabChange, onOpenSidebar }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-md border-t flex items-center justify-around px-2 md:hidden pb-safe">
      <button
        onClick={() => onTabChange('all')}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
          activeTab === 'all' ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium">전체</span>
      </button>

      <button
        onClick={onOpenSidebar}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
          activeTab === 'folders' ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Folder className="w-5 h-5" />
        <span className="text-[10px] font-medium">폴더</span>
      </button>

      <button
        onClick={() => onTabChange('websites')}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
          activeTab === 'websites' ? "text-primary" : "text-muted-foreground"
        )}
      >
        <LinkIcon className="w-5 h-5" />
        <span className="text-[10px] font-medium">북마크</span>
      </button>

      <button
        onClick={() => onTabChange('search')}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
          activeTab === 'search' ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Search className="w-5 h-5" />
        <span className="text-[10px] font-medium">검색</span>
      </button>

      <button
        onClick={() => onTabChange('profile')}
        className={cn(
          "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
          activeTab === 'profile' ? "text-primary" : "text-muted-foreground"
        )}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-medium">정보</span>
      </button>
    </nav>
  )
}
