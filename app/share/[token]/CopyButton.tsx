'use client'

// 공유 페이지 내용 복사 버튼 - 클라이언트 컴포넌트
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? (
        <><Check className="w-4 h-4 text-green-500" /> 복사됨</>
      ) : (
        <><Copy className="w-4 h-4" /> 복사</>
      )}
    </Button>
  )
}
