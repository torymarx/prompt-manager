'use client'

// ssr: false 동적 임포트를 담당하는 Client Component 래퍼
// Supabase createBrowserClient는 브라우저에서만 실행돼야 함
import dynamic from 'next/dynamic'

const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-muted-foreground text-sm animate-pulse">불러오는 중...</div>
    </div>
  ),
})

export function ClientWrapper() {
  return <DashboardClient />
}
