'use client'

// 프롬프트 카드 컴포넌트 - 그리드/리스트 뷰 모두 지원 (모바일/터치 최적화)
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Pencil, Trash2, Tag, Link, Link2Off, X, ZoomIn, Maximize2, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Prompt, ViewMode } from '@/lib/types'

interface PromptCardProps {
  prompt: Prompt
  viewMode: ViewMode
  readOnly?: boolean  // 읽기 전용 모드 (공유 뷰어에서 사용)
  searchQuery?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
  onEdit?: (prompt: Prompt) => void
  onDelete?: (prompt: Prompt) => void
  onShare?: (prompt: Prompt) => void
  onStopShare?: (prompt: Prompt) => void
}

/** 검색어 하이라이트 렌더링 */
function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <span>{text}</span>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
            {part}
          </mark>
        ) : part
      )}
    </span>
  )
}

import { useSmartCrop } from '@/lib/hooks/useSmartCrop'

/** 이미지 로드 실패 시 깨진 이미지 대신 빈 공간 처리 + 스마트 크롭 지원 */
function SafeImage({ src, alt, className, style, onClick }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [broken, setBroken] = useState(false)
  const smartPosition = useSmartCrop(src)

  if (broken) return null
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        ...style,
        objectPosition: smartPosition
      }}
      onClick={onClick}
      onError={() => setBroken(true)}
    />
  )
}

/** 이미지 라이트박스 */
function ImageLightbox({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* 닫기 버튼 - 터치 타겟 최소 44px */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 active:bg-black/90 transition-colors"
        aria-label="닫기"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="absolute top-4 left-4 z-10 text-white text-sm font-medium drop-shadow-lg max-w-[calc(100%-5rem)] truncate">
        {title}
      </div>
      <SafeImage
        src={src}
        alt={title}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-zoom-out"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
    </div>
  )
}

/** 내용 전체보기 모달 - 모바일 풀스크린 지원 */
function ContentModal({ prompt, onClose, onEdit, onImageClick, readOnly }: { prompt: Prompt; onClose: () => void; onEdit?: () => void; onImageClick?: () => void; readOnly?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content)
    setCopied(true)
    toast.success('내용이 복사되었습니다.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      style={{ touchAction: 'none' }}
      onClick={onClose}
    >
      {/* 모바일: 하단 시트, 태블릿/PC: 중앙 모달 */}
      <div
        className={cn(
          'relative w-full flex flex-col bg-background',
          // 모바일: 하단 시트 스타일 (최대 90% 높이 - dvh로 모바일 주소창 대응)
          'max-h-[90dvh] rounded-t-2xl sm:rounded-2xl shadow-2xl',
          // 태블릿/PC: 중앙 모달
          prompt.image_url
            ? 'sm:max-w-5xl sm:flex-row sm:max-h-[85dvh]'
            : 'sm:max-w-3xl sm:max-h-[90dvh]'
        )}
        style={{ overscrollBehavior: 'contain' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />

        {/* 상단/좌측: 이미지 (이미지 있을 때만) */}
        {prompt.image_url && (
          <button
            onClick={onImageClick}
            className="relative w-full sm:w-2/5 shrink-0 bg-black flex items-center justify-center overflow-hidden max-h-[30vh] sm:max-h-none group/modal-img cursor-zoom-in"
            aria-label="이미지 크게 보기"
          >
            <SafeImage
              src={prompt.image_url}
              alt={prompt.title}
              className="w-full h-full block object-cover sm:object-contain transition-transform group-hover/modal-img:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/modal-img:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/40 text-white p-2 rounded-full backdrop-blur-sm">
                <Maximize2 className="w-5 h-5" />
              </div>
            </div>
          </button>
        )}

        {/* 우측(또는 전체): 프롬프트 내용 */}
        <div className={cn(
          'flex flex-col min-w-0 min-h-0',
          prompt.image_url ? 'sm:flex-1' : 'w-full',
          'flex-1' // 모바일에서 남은 공간 채우기
        )}>
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-6 sm:py-4 pb-3 border-b shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate">{prompt.title}</h2>
              {prompt.tags.length > 0 && (
                <div className="overflow-x-auto mt-1.5" style={{ scrollbarWidth: 'none' }}>
                  <div className="flex gap-1 flex-nowrap">
                    {prompt.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs shrink-0">
                        <Tag className="w-2.5 h-2.5 mr-1" />{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {prompt.link_url && (
                <a
                  href={prompt.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-500 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {(() => { try { return new URL(prompt.link_url).hostname } catch { return prompt.link_url } })()}
                </a>
              )}
            </div>
            {/* 닫기 버튼 - 터치 타겟 44px */}
            <button
              onClick={onClose}
              className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 마크다운 내용 */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt }) => (
                    <SafeImage
                      src={src ?? ''}
                      alt={alt ?? ''}
                      className="w-full h-auto rounded-lg block"
                    />
                  ),
                }}
              >
                {prompt.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* 하단 액션 - 버튼 크기 모바일 최적화 */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t shrink-0 bg-muted/30">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-10 sm:h-9 text-sm"
                onClick={handleCopy}
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-green-500" /> 복사됨</>
                  : <><Copy className="w-3.5 h-3.5" /> 내용 복사</>
                }
              </Button>
              {prompt.link_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-10 sm:h-9 text-sm text-blue-500 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950"
                  onClick={() => window.open(prompt.link_url!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">링크 열기</span>
                </Button>
              )}
            </div>
            {/* 읽기 전용 모드에서는 수정 버튼 숨김 */}
            {!readOnly && onEdit && (
              <Button
                size="sm"
                className="gap-1.5 h-10 sm:h-9 text-sm"
                onClick={() => { onClose(); onEdit() }}
              >
                <Pencil className="w-3.5 h-3.5" /> 수정
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PromptCard({ prompt, viewMode, readOnly, searchQuery, onMoveUp, onMoveDown, onEdit, onDelete, onShare, onStopShare }: PromptCardProps) {
  const [copied, setCopied] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [contentOpen, setContentOpen] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (viewMode === 'list') {
    return (
      <>
        <div className="flex items-start gap-2 sm:gap-4 px-3 sm:px-4 py-3 border-b hover:bg-accent/30 active:bg-accent/50 transition-colors group">
          {/* 순서 이동 버튼 - 읽기 전용 모드에서는 숨김 */}
          {!readOnly && (
            <div className="flex flex-col shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onMoveUp?.()}
                disabled={!onMoveUp}
                className="p-1.5 hover:text-foreground active:text-foreground text-muted-foreground disabled:opacity-30 min-h-[36px] flex items-center"
                aria-label="위로 이동"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMoveDown?.()}
                disabled={!onMoveDown}
                className="p-1.5 hover:text-foreground active:text-foreground text-muted-foreground disabled:opacity-30 min-h-[36px] flex items-center"
                aria-label="아래로 이동"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 썸네일 */}
          {prompt.image_url && (
            <button
              onClick={() => setContentOpen(true)}
              className="relative shrink-0 group/thumb min-h-[44px] min-w-[44px] bg-muted/30 rounded overflow-hidden"
              aria-label="내용 보기"
            >
              <SafeImage
                src={prompt.image_url}
                alt=""
                className="w-11 h-11 object-cover transition-opacity group-hover/thumb:opacity-80"
              />
            </button>
          )}

          {/* 내용 - 클릭 시 전체보기 */}
          <button
            className="flex-1 min-w-0 text-left hover:opacity-80 active:opacity-70 transition-opacity py-1 flex items-center"
            onClick={() => setContentOpen(true)}
            aria-label="내용 전체 보기"
          >
            <p className="font-medium truncate text-sm sm:text-base">
              <HighlightedText text={prompt.title} query={searchQuery} />
            </p>
          </button>

          {/* 액션 버튼 - 모바일: 항상 표시, PC: hover 시 표시 */}
          <div className="flex gap-0.5 sm:gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8"
              onClick={() => setContentOpen(true)}
              title="전체보기"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8"
              onClick={handleCopy}
              title="복사"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            {/* 읽기 전용 모드에서는 공유/수정/삭제 버튼 숨김 */}
            {!readOnly && (
              <>
                {prompt.disable_share ? (
                  <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" disabled title="공유 제외됨">
                    <Link2Off className="w-4 h-4 text-muted-foreground/30" />
                  </Button>
                ) : prompt.is_public ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" title="공유 관리">
                        <Link className="w-4 h-4 text-green-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onShare?.(prompt)} className="text-sm py-3">
                        <Link className="w-4 h-4 mr-2" /> 링크 복사
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStopShare?.(prompt)} className="text-destructive text-sm py-3">
                        <Link2Off className="w-4 h-4 mr-2" /> 공유 중지
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" onClick={() => onShare?.(prompt)} title="공유 시작">
                    <Link className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  onClick={() => onEdit?.(prompt)}
                  title="수정"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete?.(prompt)}
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {lightboxOpen && prompt.image_url && (
          <ImageLightbox src={prompt.image_url} title={prompt.title} onClose={() => setLightboxOpen(false)} />
        )}
        {contentOpen && (
          <ContentModal
            prompt={prompt}
            onClose={() => setContentOpen(false)}
            onEdit={onEdit ? () => onEdit(prompt) : undefined}
            onImageClick={() => setLightboxOpen(true)}
            readOnly={readOnly}
          />
        )}
      </>
    )
  }

  // 그리드 뷰
  return (
    <>
      <div className="group relative flex flex-col rounded-xl border bg-card hover:border-primary/50 active:border-primary/70 transition-all hover:shadow-md overflow-hidden">
        {/* 썸네일 */}
        {prompt.image_url ? (
          <button
            onClick={() => setContentOpen(true)}
            className={cn(
              'relative w-full overflow-hidden group/thumb bg-muted/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            aria-label="내용 보기"
          >
            <SafeImage
              src={prompt.image_url}
              alt=""
              className="w-full h-40 sm:h-48 object-cover transition-transform duration-200 group-hover/thumb:scale-105"
            />
          </button>
        ) : (
          <div className="w-full h-1.5 bg-gradient-to-r from-primary/30 to-primary/60" />
        )}

        {/* 내용 영역 - 클릭 시 전체보기 */}
        <button
          className="flex flex-col p-3 sm:p-4 gap-2 text-left hover:bg-accent/10 active:bg-accent/20 transition-colors"
          onClick={() => setContentOpen(true)}
          aria-label="내용 전체 보기"
        >
          <h3 className="font-semibold line-clamp-2 text-sm sm:text-base leading-snug">
            <HighlightedText text={prompt.title} query={searchQuery} />
          </h3>
        </button>

        {/* 액션 버튼 영역 - 항상 표시 (터치 최적화) */}
        <div className="flex items-center gap-0.5 px-2 sm:px-3 pb-2 sm:pb-3 border-t pt-2" onClick={(e) => e.stopPropagation()}>
          {/* 순서 이동 버튼 - 읽기 전용 모드에서는 숨김 */}
          {!readOnly && (
            <>
              <button
                onClick={() => onMoveUp?.()}
                disabled={!onMoveUp}
                className="h-9 w-7 flex items-center justify-center hover:text-foreground active:text-foreground text-muted-foreground disabled:opacity-30"
                aria-label="위로 이동"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMoveDown?.()}
                disabled={!onMoveDown}
                className="h-9 w-7 flex items-center justify-center hover:text-foreground active:text-foreground text-muted-foreground disabled:opacity-30"
                aria-label="아래로 이동"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 text-xs gap-1"
            onClick={handleCopy}
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 text-green-500" /> 복사됨</>
              : <><Copy className="w-3.5 h-3.5" /> 복사</>
            }
          </Button>
          {/* 읽기 전용 모드에서는 공유/수정/삭제 버튼 숨김 */}
          {!readOnly && (
            <>
              {prompt.disable_share ? (
                <Button variant="ghost" size="icon" className="h-9 w-9" disabled title="공유 제외됨">
                  <Link2Off className="w-3.5 h-3.5 text-muted-foreground/30" />
                </Button>
              ) : prompt.is_public ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9" title="공유 관리">
                      <Link className="w-3.5 h-3.5 text-green-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onShare?.(prompt)} className="text-sm py-3">
                      <Link className="w-4 h-4 mr-2" /> 링크 복사
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStopShare?.(prompt)} className="text-destructive text-sm py-3">
                      <Link2Off className="w-4 h-4 mr-2" /> 공유 중지
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onShare?.(prompt)} title="공유 시작">
                  <Link className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit?.(prompt)} title="수정">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:text-destructive"
                onClick={() => onDelete?.(prompt)}
                title="삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {lightboxOpen && prompt.image_url && (
        <ImageLightbox src={prompt.image_url} title={prompt.title} onClose={() => setLightboxOpen(false)} />
      )}
      {contentOpen && (
        <ContentModal
          prompt={prompt}
          onClose={() => setContentOpen(false)}
          onEdit={onEdit ? () => onEdit(prompt) : undefined}
          onImageClick={() => setLightboxOpen(true)}
          readOnly={readOnly}
        />
      )}
    </>
  )
}
