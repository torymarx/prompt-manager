// 공개 공유 페이지 - 비로그인 사용자도 접근 가능한 서버 컴포넌트
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { CopyButton } from './CopyButton'

interface SharePageProps {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params
  const supabase = await createClient()

  // 토큰으로 공개된 프롬프트 조회 (폴더 정보 포함)
  const { data: prompt } = await supabase
    .from('prompts')
    .select('id, user_id, folder_id, title, content, tags, image_url, is_public')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  // 존재하지 않거나 비공개인 경우
  if (!prompt) {
    notFound()
  }

  // --- Restricted Sharing Logic ---
  // 개별 공유된 프롬프트라도 "인물" 또는 "그림" 폴더에 속해 있어야 함
  if (prompt.folder_id) {
    // 모든 폴더를 가져와서 경로 추적 (성능상 상위 폴더들만 가져오는 것이 좋으나, 폴더 수가 적으므로 전체 조회 후 필터링)
    const { data: allFolders } = await supabase
      .from('folders')
      .select('id, name, parent_id')
      .eq('user_id', prompt.user_id)

    const allowedKeywordRegex = /인물|그림/
    const isFolderAllowed = (folderId: string): boolean => {
      const folder = allFolders?.find(f => f.id === folderId)
      if (!folder) return false
      if (allowedKeywordRegex.test(folder.name)) return true
      if (folder.parent_id) return isFolderAllowed(folder.parent_id)
      return false
    }

    if (!isFolderAllowed(prompt.folder_id)) {
      notFound()
    }
  } else {
    // 폴더가 없는(미분류) 프롬프트는 정책상 공유 금지 (인물/그림 폴더에 수동으로 넣어야 함)
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-lg">
          🧠 프롬프트 매니저
        </div>
        <CopyButton content={prompt.content} />
      </header>

      {/* 본문 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className={prompt.image_url ? 'flex flex-col sm:flex-row gap-6 sm:gap-10 items-start' : ''}>

          {/* 상단/좌측: 이미지 (이미지 있을 때만) */}
          {prompt.image_url && (
            <div className="w-full sm:w-2/5 shrink-0 bg-black rounded-xl overflow-hidden max-h-[40vh] sm:max-h-none">
              <img
                src={prompt.image_url}
                alt=""
                className="w-full h-full object-cover sm:object-contain sm:sticky sm:top-6"
              />
            </div>
          )}

          {/* 우측(또는 전체): 내용 */}
          <div className="flex-1 min-w-0">
            {/* 제목 */}
            <h1 className="text-2xl font-bold mb-3">{prompt.title}</h1>

            {/* 태그 */}
            {prompt.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-6">
                {prompt.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}

            {/* 구분선 */}
            <hr className="mb-6" />

            {/* 내용 */}
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {prompt.content}
            </pre>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Naku Lab Studio · naku.lab.studio@kakao.com
      </footer>
    </div>
  )
}
