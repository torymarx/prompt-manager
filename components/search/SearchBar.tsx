'use client'

// 상단 검색 바 컴포넌트 - #해시태그 검색 지원
import { Hash, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const isHashtag = value.startsWith('#')

  return (
    <div className="relative w-full max-w-md">
      {/* 해시태그 모드면 # 아이콘, 아니면 돋보기 */}
      {isHashtag ? (
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
      ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      )}

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#태그 또는 제목·내용으로 검색..."
        className={cn(
          'pl-9 pr-8 h-9 transition-colors',
          isHashtag && 'border-primary/50 focus-visible:ring-primary/30'
        )}
      />

      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => onChange('')}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* 해시태그 검색 중 힌트 뱃지 */}
      {isHashtag && value.length > 1 && (
        <div className="absolute left-0 -bottom-6 flex items-center gap-1 text-xs text-primary">
          <Hash className="w-3 h-3" />
          <span>태그로 검색 중</span>
        </div>
      )}
    </div>
  )
}
