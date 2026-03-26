'use client'

// 대시보드 실제 UI - 사이드바(폴더 트리) + 헤더(검색/테마/로그아웃) + 프롬프트 목록
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import { PromptList } from '@/components/prompts/PromptList'
import { WebsiteList } from '@/components/websites/WebsiteList'
import { SearchBar } from '@/components/search/SearchBar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { CollectionShareButton } from '@/components/collection/CollectionShareButton'
import { Button } from '@/components/ui/button'
import { useSearch } from '@/lib/hooks/useSearch'
import { useFolders, getDescendantIds } from '@/lib/hooks/useFolders'
import { LogOut, ChevronRight, BrainCircuit, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardClient() {
  const router = useRouter()
  const supabase = createClient()
  const { folders } = useFolders()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])// eslint-disable-line react-hooks/exhaustive-deps

  const { query, setQuery, results, searching } = useSearch()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFolderType, setSelectedFolderType] = useState<'prompt' | 'website'>('prompt')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // 스와이프 감지용 ref
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    // 화면 왼쪽 가장자리(30px 이내)에서 시작한 오른쪽 스와이프만 사이드바 열기
    // 수직 이동이 수평 이동보다 크면 스크롤로 간주하여 무시
    if (touchStartX.current < 30 && deltaX > 50 && deltaY < deltaX) {
      setMobileSidebarOpen(true)
    }
    // 사이드바가 열린 상태에서 왼쪽 스와이프로 닫기
    if (mobileSidebarOpen && deltaX < -60 && deltaY < Math.abs(deltaX)) {
      setMobileSidebarOpen(false)
    }
  }

  // 선택된 폴더 정보
  const selectedFolder = folders.find((f) => f.id === selectedFolderId)
  const folderName = selectedFolderId
    ? (selectedFolder?.name || '폴더')
    : '전체 프롬프트'

  const handleSelectFolder = (id: string | null, type?: 'prompt' | 'website') => {
    setSelectedFolderId(id)
    setSelectedFolderType(id ? (type ?? 'prompt') : 'prompt')
    setMobileSidebarOpen(false)
  }

  const isWebsiteFolder = selectedFolderId ? selectedFolderType === 'website' : false

  const activeFolderIds = useMemo<string[] | undefined>(() => {
    if (!selectedFolderId) return undefined
    return [selectedFolderId, ...getDescendantIds(selectedFolderId, folders)]
  }, [selectedFolderId, folders])

  const buildBreadcrumb = (folderId: string | null): string[] => {
    if (!folderId) return []
    const crumbs: string[] = []
    let currentId: string | null = folderId
    const visited = new Set<string>()
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const f = folders.find((x) => x.id === currentId)
      if (!f) break
      crumbs.unshift(f.name)
      currentId = f.parent_id ?? null
    }
    return crumbs
  }
  const breadcrumb = buildBreadcrumb(selectedFolderId)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* 모바일 오버레이 배경 */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 */}
      <div className={`
        fixed inset-y-0 left-0 z-40 md:relative md:z-auto
        transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <Sidebar
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
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
        {/* 상단 헤더 */}
        <header className="flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">

          {/* 모바일: 로고 아이콘 탭으로 사이드바 열기 (햄버거 버튼 대체) */}
          <button
            className="md:hidden shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary active:opacity-80 transition-opacity"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="메뉴 열기"
          >
            <BrainCircuit className="w-4 h-4 text-primary-foreground" />
          </button>

          {/* 브레드크럼 */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0 flex-1 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedFolderId(null)}
              className="hover:text-foreground active:text-foreground transition-colors shrink-0 font-medium px-1 flex items-center"
            >
              전체
            </button>
            {breadcrumb.map((name, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className={cn(
                  'max-w-[100px] sm:max-w-[150px] truncate transition-colors px-1',
                  i === breadcrumb.length - 1 ? 'text-foreground font-semibold' : ''
                )}>
                  {name}
                </span>
              </span>
            ))}
          </div>

          {/* 검색 + 액션 */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <div className="w-auto flex-1 sm:flex-none min-w-[40px] sm:min-w-[200px] md:min-w-[240px]">
              <SearchBar value={query} onChange={setQuery} />
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <CollectionShareButton />
              <ThemeToggle />
            </div>
            {userEmail && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs text-muted-foreground max-w-[180px]">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{userEmail}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="로그아웃"
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* 컨텐츠 */}
        <main className="flex-1 overflow-hidden">
          {isWebsiteFolder ? (
            <WebsiteList
              folderIds={activeFolderIds}
              folderName={folderName}
            />
          ) : (
            <PromptList
              folderIds={activeFolderIds}
              folderName={folderName}
              searchQuery={query || undefined}
              searchResults={query ? results : undefined}
              isSearching={searching}
            />
          )}
        </main>
      </div>
    </div>
  )
}
