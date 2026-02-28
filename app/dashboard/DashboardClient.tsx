'use client'

// 대시보드 실제 UI - 사이드바(폴더 트리) + 헤더(검색/테마/로그아웃) + 프롬프트 목록
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import { PromptList } from '@/components/prompts/PromptList'
import { WebsiteList } from '@/components/websites/WebsiteList'
import { SearchBar } from '@/components/search/SearchBar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useSearch } from '@/lib/hooks/useSearch'
import { useFolders, getDescendantIds } from '@/lib/hooks/useFolders'
import { LogOut, ChevronRight } from 'lucide-react'

export default function DashboardClient() {
  const router = useRouter()
  const supabase = createClient()
  const { folders } = useFolders()
  const { query, setQuery, results, searching } = useSearch()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 선택된 폴더 정보
  const selectedFolder = folders.find((f) => f.id === selectedFolderId)
  const folderName = selectedFolderId
    ? (selectedFolder?.name || '폴더')
    : '전체 프롬프트'

  // 선택된 폴더가 웹사이트 타입인지 확인
  const isWebsiteFolder = selectedFolderId
    ? selectedFolder?.folder_type === 'website'
    : false

  // 선택 폴더 + 모든 하위 폴더 ID 배열 (undefined = 전체 조회)
  const activeFolderIds = useMemo<string[] | undefined>(() => {
    if (!selectedFolderId) return undefined
    return [selectedFolderId, ...getDescendantIds(selectedFolderId, folders)]
  }, [selectedFolderId, folders])

  // 브레드크럼: 상위 폴더까지 경로 추적
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 좌측 사이드바 */}
      <Sidebar
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      {/* 우측 메인 영역 */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* 상단 헤더 */}
        <header className="flex items-center gap-3 px-6 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
          {/* 브레드크럼 */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0 flex-1">
            <button
              onClick={() => setSelectedFolderId(null)}
              className="hover:text-foreground transition-colors shrink-0 font-medium"
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
          <div className="flex items-center gap-2 shrink-0">
            <SearchBar value={query} onChange={setQuery} />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* 폴더 타입에 따라 웹사이트 목록 또는 프롬프트 목록 표시 */}
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
