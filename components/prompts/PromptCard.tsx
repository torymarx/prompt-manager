'use client'

// 프롬프트 카드 컴포넌트 - 그리드/리스트 뷰 모두 지원
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
  searchQuery?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
  onEdit: (prompt: Prompt) => void
  onDelete: (prompt: Prompt) => void
  onShare: (prompt: Prompt) => void
  onStopShare: (prompt: Prompt) => void
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

/** 이미지 로드 실패 시 깨진 이미지 대신 빈 공간 처리 */
function SafeImage({ src, alt, className, style, onClick }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
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
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

/** 내용 전체보기 모달 */
function ContentModal({ prompt, onClose, onEdit }: { prompt: Prompt; onClose: () => void; onEdit: () => void }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-h-[90vh] flex bg-background rounded-2xl shadow-2xl overflow-hidden ${
          prompt.image_url ? 'max-w-5xl' : 'max-w-3xl flex-col'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌측: 이미지 (이미지 있을 때만) */}
        {prompt.image_url && (
          <div className="w-2/5 shrink-0 bg-black flex items-center justify-center overflow-hidden">
            <SafeImage
              src={prompt.image_url}
              alt={prompt.title}
              className="w-full h-auto block"
            />
          </div>
        )}

        {/* 우측(또는 전체): 프롬프트 내용 */}
        <div className={`flex flex-col min-w-0 ${prompt.image_url ? 'flex-1' : 'w-full'}`}>
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{prompt.title}</h2>
              {prompt.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1.5">
                  {prompt.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="w-2.5 h-2.5 mr-1" />{tag}
                    </Badge>
                  ))}
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
            <button
              onClick={onClose}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 마크다운 내용 */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
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

          {/* 하단 액션 */}
          <div className="flex items-center justify-between gap-2 px-6 py-3 border-t shrink-0 bg-muted/30">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
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
                  className="gap-1.5 text-blue-500 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950"
                  onClick={() => window.open(prompt.link_url!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> 링크 열기
                </Button>
              )}
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { onClose(); onEdit() }}
            >
              <Pencil className="w-3.5 h-3.5" /> 수정
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PromptCard({ prompt, viewMode, searchQuery, onMoveUp, onMoveDown, onEdit, onDelete, onShare, onStopShare }: PromptCardProps) {
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
        <div className="flex items-start gap-4 px-4 py-3 border-b hover:bg-accent/30 transition-colors group">
          {/* 순서 이동 버튼 */}
          <div className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onMoveUp?.()} disabled={!onMoveUp} className="p-0.5 hover:text-foreground text-muted-foreground disabled:opacity-30" aria-label="위로 이동">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onMoveDown?.()} disabled={!onMoveDown} className="p-0.5 hover:text-foreground text-muted-foreground disabled:opacity-30" aria-label="아래로 이동">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* 썸네일 */}
          {prompt.image_url && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="relative shrink-0 group/thumb"
              aria-label="이미지 크게 보기"
            >
              <SafeImage
                src={prompt.image_url}
                alt=""
                className="w-10 h-10 rounded object-cover transition-opacity group-hover/thumb:opacity-80"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                <ZoomIn className="w-4 h-4 text-white drop-shadow-md" />
              </div>
            </button>
          )}

          {/* 내용 - 클릭 시 전체보기 */}
          <button
            className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            onClick={() => setContentOpen(true)}
            aria-label="내용 전체 보기"
          >
            <p className="font-medium truncate">
              <HighlightedText text={prompt.title} query={searchQuery} />
            </p>
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
              <HighlightedText text={prompt.content} query={searchQuery} />
            </p>
            {prompt.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {prompt.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <HighlightedText text={tag} query={searchQuery} />
                  </Badge>
                ))}
              </div>
            )}
          </button>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setContentOpen(true)} title="전체보기">
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            {prompt.is_public ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="공유 관리">
                    <Link className="w-4 h-4 text-green-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onShare(prompt)}>
                    <Link className="w-4 h-4 mr-2" /> 링크 복사
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStopShare(prompt)} className="text-destructive">
                    <Link2Off className="w-4 h-4 mr-2" /> 공유 중지
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onShare(prompt)} title="공유 시작">
                <Link className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(prompt)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(prompt)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {lightboxOpen && prompt.image_url && (
          <ImageLightbox src={prompt.image_url} title={prompt.title} onClose={() => setLightboxOpen(false)} />
        )}
        {contentOpen && (
          <ContentModal prompt={prompt} onClose={() => setContentOpen(false)} onEdit={() => onEdit(prompt)} />
        )}
      </>
    )
  }

  // 그리드 뷰
  return (
    <>
      <div className="group relative flex flex-col rounded-xl border bg-card hover:border-primary/50 transition-all hover:shadow-md overflow-hidden">
        {/* 썸네일 */}
        {prompt.image_url ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className={cn(
              'relative w-full overflow-hidden group/thumb',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            aria-label="이미지 크게 보기"
          >
            <SafeImage
              src={prompt.image_url}
              alt=""
              className="w-full h-32 object-cover transition-transform duration-200 group-hover/thumb:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
              <div className="flex items-center gap-1.5 text-white text-xs font-medium bg-black/40 rounded-full px-3 py-1.5">
                <ZoomIn className="w-3.5 h-3.5" /> 크게 보기
              </div>
            </div>
          </button>
        ) : (
          <div className="w-full h-2 bg-gradient-to-r from-primary/30 to-primary/60" />
        )}

        {/* 내용 영역 - 클릭 시 전체보기 */}
        <button
          className="flex flex-col flex-1 p-4 gap-2 text-left hover:bg-accent/10 transition-colors"
          onClick={() => setContentOpen(true)}
          aria-label="내용 전체 보기"
        >
          <h3 className="font-semibold line-clamp-1">
            <HighlightedText text={prompt.title} query={searchQuery} />
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
            <HighlightedText text={prompt.content} query={searchQuery} />
          </p>
          {prompt.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {prompt.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="w-2.5 h-2.5 mr-1" />
                  <HighlightedText text={tag} query={searchQuery} />
                </Badge>
              ))}
              {prompt.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">+{prompt.tags.length - 3}</Badge>
              )}
            </div>
          )}
          {prompt.link_url && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-500">
              <ExternalLink className="w-3 h-3" />
              {(() => { try { return new URL(prompt.link_url).hostname } catch { return '링크' } })()}
            </span>
          )}
        </button>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 px-4 pb-3 border-t pt-2" onClick={(e) => e.stopPropagation()}>
          {/* 순서 이동 버튼 */}
          <button onClick={() => onMoveUp?.()} disabled={!onMoveUp} className="h-8 w-6 flex items-center justify-center hover:text-foreground text-muted-foreground disabled:opacity-30" aria-label="위로 이동">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMoveDown?.()} disabled={!onMoveDown} className="h-8 w-6 flex items-center justify-center hover:text-foreground text-muted-foreground disabled:opacity-30" aria-label="아래로 이동">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={handleCopy}>
            {copied
              ? <><Check className="w-3.5 h-3.5 text-green-500" /> 복사됨</>
              : <><Copy className="w-3.5 h-3.5" /> 복사</>
            }
          </Button>
          {prompt.is_public ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="공유 관리">
                  <Link className="w-3.5 h-3.5 text-green-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onShare(prompt)}>
                  <Link className="w-4 h-4 mr-2" /> 링크 복사
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStopShare(prompt)} className="text-destructive">
                  <Link2Off className="w-4 h-4 mr-2" /> 공유 중지
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onShare(prompt)} title="공유 시작">
              <Link className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(prompt)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(prompt)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {lightboxOpen && prompt.image_url && (
        <ImageLightbox src={prompt.image_url} title={prompt.title} onClose={() => setLightboxOpen(false)} />
      )}
      {contentOpen && (
        <ContentModal prompt={prompt} onClose={() => setContentOpen(false)} onEdit={() => onEdit(prompt)} />
      )}
    </>
  )
}
