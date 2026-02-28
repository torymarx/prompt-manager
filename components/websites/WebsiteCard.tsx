'use client'

// 웹사이트 북마크 카드 - 썸네일 + 제목 + 도메인 + 외부 링크
import { Globe, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Prompt } from '@/lib/types'

interface WebsiteCardProps {
  website: Prompt
  onEdit: (w: Prompt) => void
  onDelete: (w: Prompt) => void
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export function WebsiteCard({ website, onEdit, onDelete }: WebsiteCardProps) {
  return (
    <div className="group relative flex flex-col rounded-xl border bg-card hover:border-primary/50 transition-all hover:shadow-md overflow-hidden">
      {/* 썸네일 - 클릭 시 새 탭 열기 */}
      <a
        href={website.content}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden bg-muted"
        style={{ aspectRatio: '16/9' }}
      >
        {website.image_url ? (
          <img
            src={website.image_url}
            alt={website.title}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              el.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        {/* 썸네일 없거나 에러 시 플레이스홀더 */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${website.image_url ? 'hidden' : ''}`}>
          <Globe className="w-10 h-10 text-muted-foreground/30" />
          <span className="text-xs text-muted-foreground/50">{getDomain(website.content)}</span>
        </div>
        {/* 호버 시 열기 오버레이 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> 열기
          </div>
        </div>
      </a>

      {/* 정보 + 액션 */}
      <div className="flex items-start gap-2 p-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate leading-snug">{website.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{getDomain(website.content)}</p>
        </div>
        {/* 호버 시 액션 버튼 */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(website)}
            title="수정"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(website)}
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
