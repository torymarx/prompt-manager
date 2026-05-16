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

import { BottomNav } from '@/components/layout/BottomNav'

export default function DashboardClient() {
  const router = useRouter()
  const supabase = createClient()
  const { folders } = useFolders()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFolderType, setSelectedFolderType] = useState<'prompt' | 'website'>('prompt')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { query, setQuery, results, searching } = useSearch()

  // v3.5.0: 뒤로가기(popstate)와 폴더 선택 상태 동기화
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })

    // 초기 상태 push
    if (window.history.state === null) {
      window.history.replaceState({ folderId: null, folderType: 'prompt' }, '')
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state
      if (state) {
        setSelectedFolderId(state.folderId)
        setSelectedFolderType(state.folderType || 'prompt')
      } else {
        setSelectedFolderId(null)
        setSelectedFolderType('prompt')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectFolder = (id: string | null, type?: 'prompt' | 'website') => {
    const newType = id && id !== '__UNCLASSIFIED__' ? (type ?? 'prompt') : 'prompt'
    
    // 현재 상태와 다를 때만 히스토리 push
    if (id !== selectedFolderId || newType !== selectedFolderType) {
      window.history.pushState({ folderId: id, folderType: newType }, '')
      setSelectedFolderId(id)
      setSelectedFolderType(newType)
    }
    setMobileSidebarOpen(false)
  }

  // 모바일 하단 탭 관리용
  const currentTab = useMemo(() => {
    if (selectedFolderId === null) return 'all'
    if (selectedFolderType === 'website') return 'websites'
    return 'folders'
  }, [selectedFolderId, selectedFolderType])

  const handleTabChange = (tab: string) => {
    if (tab === 'all') handleSelectFolder(null)
    if (tab === 'websites') {
      // 가장 최근에 방문한 북마크 폴더가 있다면 그곳으로, 없으면 전체 북마크?
      // 여기서는 편의상 전체 북마크 폴더 리스트를 보여주는 사이드바를 열거나 할 수 있지만
      // 일단 '북마크' 타입인 첫 번째 폴더로 이동하는 식으로 구현 가능
      const firstWebFolder = folders.find(f => f.type === 'website')
      handleSelectFolder(firstWebFolder?.id || null, 'website')
    }
    if (tab === 'search') {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
      if (searchInput) searchInput.focus()
    }
    if (tab === 'profile') {
      // 정보 탭은 간단한 로그아웃 확인이나 유저 정보 표시
      if (window.confirm(`${userEmail} 계정으로 로그인되어 있습니다.\n로그아웃 하시겠습니까?`)) {
        handleLogout()
      }
    }
  }

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
    // 화면 왼쪽 가장자리(40px 이내)에서 시작한 오른쪽 스와이프만 사이드바 열기
    if (touchStartX.current < 40 && deltaX > 80 && deltaY < deltaX * 0.5) {
      setMobileSidebarOpen(true)
    }
    // 사이드바가 열린 상태에서 왼쪽 스와이프로 닫기
    if (mobileSidebarOpen && deltaX < -80 && deltaY < Math.abs(deltaX) * 0.5) {
      setMobileSidebarOpen(false)
    }
  }

  // 선택된 폴더 정보
  const selectedFolder = folders.find((f) => f.id === selectedFolderId)
  const folderName = selectedFolderId === '__UNCLASSIFIED__'
    ? '미분류 프롬프트'
    : selectedFolderId
    ? (selectedFolder?.name || '폴더')
    : '전체 프롬프트'

  const isWebsiteFolder = selectedFolderId ? selectedFolderType === 'website' : false

  const activeFolderIds = useMemo<string[] | undefined>(() => {
    if (!selectedFolderId) return undefined
    if (selectedFolderId === '__UNCLASSIFIED__') return ['__UNCLASSIFIED__']
    return [selectedFolderId, ...getDescendantIds(selectedFolderId, folders)]
  }, [selectedFolderId, folders])

  const buildBreadcrumb = (folderId: string | null): string[] => {
    if (!folderId) return []
    if (folderId === '__UNCLASSIFIED__') return ['미분류']
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
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
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
        <header className="flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-20">

          {/* 모바일: 로고 아이콘 탭으로 사이드바 열기 */}
          <button
            className="md:hidden shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-primary shadow-lg shadow-primary/20 active:scale-95 transition-all"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="메뉴 열기"
          >
            <BrainCircuit className="w-5 h-5 text-primary-foreground" />
          </button>

          {/* 브레드크럼 (모바일에서 가독성 개선) */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0 flex-1 overflow-x-auto no-scrollbar py-1 ml-1 sm:ml-0">
            <button
              onClick={() => handleSelectFolder(null)}
              className="hover:text-foreground active:text-primary transition-colors shrink-0 font-medium px-1 flex items-center"
            >
              전체
            </button>
            {breadcrumb.map((name, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className={cn(
                  'max-w-[80px] sm:max-w-[150px] truncate transition-colors px-1',
                  i === breadcrumb.length - 1 ? 'text-foreground font-bold' : ''
                )}>
                  {name}
                </span>
              </span>
            ))}
          </div>

          {/* 검색 + 액션 (데스크탑 위주) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <div className="hidden sm:block sm:min-w-[200px] md:min-w-[240px]">
              <SearchBar value={query} onChange={setQuery} />
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <CollectionShareButton />
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="로그아웃"
                className="hidden sm:flex h-9 w-9"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* 컨텐츠 (모바일 하단 여백 추가) */}
        <main className="flex-1 overflow-hidden pb-16 md:pb-0">
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

        {/* 모바일 전용 하단 내비게이션 */}
        <BottomNav 
          activeTab={currentTab as any} 
          onTabChange={handleTabChange}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />
      </div>
    </div>
  )
}
