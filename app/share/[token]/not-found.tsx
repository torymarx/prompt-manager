// 존재하지 않거나 비공개 공유 링크 접근 시 표시되는 페이지
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="text-5xl">🔒</p>
      <h1 className="text-xl font-semibold">존재하지 않는 링크입니다</h1>
      <p className="text-sm text-muted-foreground">
        링크가 만료되었거나 공유가 해제된 프롬프트입니다.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/">홈으로 돌아가기</Link>
      </Button>
    </div>
  )
}
