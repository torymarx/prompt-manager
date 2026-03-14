'use client'

// 전체 컬렉션 공유 버튼
// - 공유 중이 아닐 때: "전체 공유" 버튼 → 클릭 시 링크 생성 + 클립보드 복사
// - 공유 중일 때: "공유중" 복사 버튼 + X(중지) 버튼
import { useState, useEffect } from 'react'
import { Share2, X, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ShareState {
  token: string
  expires_at: string
}

export function CollectionShareButton() {
  const [share, setShare] = useState<ShareState | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // 마운트 시 현재 공유 상태 조회
  useEffect(() => {
    fetch('/api/collection-share')
      .then((r) => r.json())
      .then(({ share: s }) => setShare(s ?? null))
      .catch(() => setShare(null))
      .finally(() => setLoading(false))
  }, [])

  const buildUrl = (token: string) =>
    `${window.location.origin}/collection/${token}`

  // 공유 시작 (링크 생성 + 클립보드 복사)
  const handleShare = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/collection-share', { method: 'POST' })
      const { share: newShare, error } = await r.json()
      if (error) {
        toast.error(error)
        return
      }
      setShare(newShare)
      await navigator.clipboard.writeText(buildUrl(newShare.token))
      toast.success('전체 공유 링크가 복사되었습니다. (2일 후 만료)')
    } catch {
      toast.error('공유 링크 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 링크 복사
  const handleCopy = async () => {
    if (!share) return
    await navigator.clipboard.writeText(buildUrl(share.token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('링크가 클립보드에 복사되었습니다.')
  }

  // 공유 중지
  const handleStop = async () => {
    setLoading(true)
    try {
      await fetch('/api/collection-share', { method: 'DELETE' })
      setShare(null)
      toast.success('전체 공유가 중지되었습니다.')
    } catch {
      toast.error('공유 중지에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 로딩 중 스피너
  if (loading) {
    return (
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </Button>
    )
  }

  // 공유 중 → 복사 + 중지 버튼
  if (share) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={handleCopy}
          title="공유 링크 복사"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          공유중
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleStop}
          title="공유 중지"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    )
  }

  // 공유 전 → 전체 공유 버튼
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 h-8 text-xs"
      onClick={handleShare}
      title="전체 프롬프트를 2일 동안 공유"
    >
      <Share2 className="w-3.5 h-3.5" />
      전체 공유
    </Button>
  )
}
