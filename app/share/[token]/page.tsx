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

  // 토큰으로 공개된 프롬프트 조회
  const { data: prompt } = await supabase
    .from('prompts')
    .select('id, title, content, tags, image_url, is_public')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  // 존재하지 않거나 비공개인 경우
  if (!prompt) {
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
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* 썸네일 */}
        {prompt.image_url && (
          <img
            src={prompt.image_url}
            alt=""
            className="w-full h-56 object-cover rounded-xl mb-6"
          />
        )}

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

        {/* 내용 - 마크다운 스타일 그대로 표시 */}
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
          {prompt.content}
        </pre>
      </main>
    </div>
  )
}
