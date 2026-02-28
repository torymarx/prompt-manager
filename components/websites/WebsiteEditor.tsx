'use client'

// 웹사이트 북마크 입력 모달
// 구성: 링크주소 → 썸네일(자동) → 제목 → 해시태그
import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Globe, Loader2, RefreshCw, X, Link, ImageIcon, Hash } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Prompt } from '@/lib/types'

type SaveValues = Omit<Prompt, 'id' | 'user_id' | 'created_at' | 'updated_at'>

interface WebsiteEditorProps {
  open: boolean
  onClose: () => void
  onSave: (values: SaveValues) => Promise<void>
  currentFolderId: string | null
  editTarget: Prompt | null
}

export function WebsiteEditor({ open, onClose, onSave, currentFolderId, editTarget }: WebsiteEditorProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // 열릴 때 초기값 세팅
  useEffect(() => {
    if (!open) return
    if (editTarget) {
      setUrl(editTarget.content)
      setTitle(editTarget.title)
      setThumbnail(editTarget.image_url)
      setTags(editTarget.tags ?? [])
    } else {
      setUrl('')
      setTitle('')
      setThumbnail(null)
      setTags([])
    }
    setTagInput('')
  }, [editTarget, open])

  // URL에서 사이트 정보(제목·썸네일) 자동 가져오기
  const fetchInfo = async (targetUrl?: string) => {
    const rawUrl = targetUrl ?? url
    if (!rawUrl.trim()) return
    const finalUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    setFetching(true)
    try {
      const res = await fetch('/api/fetch-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl }),
      })
      const { thumbnail: t, title: fetchedTitle } =
        await res.json() as { thumbnail: string | null; title: string | null }
      if (t) setThumbnail(t)
      if (fetchedTitle && !title) setTitle(fetchedTitle)
      if (!t && !fetchedTitle) toast.info('사이트에서 미리보기를 가져오지 못했습니다.')
    } catch {
      toast.error('사이트 정보 요청 중 오류가 발생했습니다.')
    } finally {
      setFetching(false)
    }
  }

  // 태그 추가 (Enter · Space · 쉼표)
  const commitTag = () => {
    const raw = tagInput.trim().replace(/^#/, '')
    if (!raw) return
    const cleaned = raw.replace(/[^가-힣a-zA-Z0-9_]/g, '')
    if (cleaned && !tags.includes(cleaned)) {
      setTags((prev) => [...prev, cleaned])
    }
    setTagInput('')
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault()
      commitTag()
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const handleSave = async () => {
    if (!url.trim()) { toast.error('링크 주소를 입력해주세요.'); return }
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    const finalUrl = url.startsWith('http') ? url : `https://${url}`
    setSaving(true)
    await onSave({
      title: title.trim(),
      content: finalUrl,
      image_url: thumbnail,
      tags,
      folder_id: currentFolderId,
      is_public: false,
      share_token: null,
    })
    setSaving(false)
    onClose()
  }

  const domain = (() => {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') }
    catch { return '' }
  })()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">

        {/* 헤더 */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10">
              <Globe className="w-4 h-4 text-blue-500" />
            </div>
            {editTarget ? '북마크 수정' : '새 북마크 추가'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-0 overflow-y-auto max-h-[70vh]">

          {/* ① 링크 주소 */}
          <div className="px-6 pt-5 pb-4 border-b">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <Link className="w-3.5 h-3.5" /> 링크 주소
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={(e) => { if (e.target.value && !editTarget) fetchInfo(e.target.value) }}
                onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => fetchInfo()}
                disabled={fetching || !url.trim()}
                title="사이트 정보 가져오기"
              >
                {fetching
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>

          {/* ② 썸네일 */}
          <div className="px-6 pt-4 pb-4 border-b">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <ImageIcon className="w-3.5 h-3.5" /> 썸네일
              <span className="normal-case font-normal ml-1 text-muted-foreground/60">
                — URL 입력 시 자동 생성
              </span>
            </label>
            <div
              className="relative w-full rounded-xl overflow-hidden border bg-muted/50 cursor-pointer group"
              style={{ aspectRatio: '16/9' }}
              onClick={() => !thumbnail && !fetching && fetchInfo()}
              title={thumbnail ? '' : '클릭해서 썸네일 가져오기'}
            >
              {thumbnail ? (
                <>
                  <img
                    src={thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setThumbnail(null)}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setThumbnail(null) }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                    title="썸네일 제거"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {domain && (
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {domain}
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Globe className="w-9 h-9 text-muted-foreground/25" />
                  <span className="text-xs text-muted-foreground/40">
                    {url ? '클릭해서 가져오기' : 'URL을 먼저 입력하세요'}
                  </span>
                </div>
              )}
              {fetching && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">가져오는 중...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ③ 제목 */}
          <div className="px-6 pt-4 pb-4 border-b">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              제목
            </label>
            <Input
              placeholder="사이트 이름 또는 설명"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && tagInputRef.current?.focus()}
            />
          </div>

          {/* ④ 해시태그 */}
          <div className="px-6 pt-4 pb-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <Hash className="w-3.5 h-3.5" /> 해시태그
              <span className="normal-case font-normal ml-1 text-muted-foreground/60">
                — Enter·Space·쉼표로 추가
              </span>
            </label>
            {/* 태그 목록 + 입력 */}
            <div
              className="flex flex-wrap gap-1.5 min-h-[40px] px-3 py-2 rounded-md border bg-background cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs pr-1">
                  #{tag}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                    className="rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={commitTag}
                placeholder={tags.length === 0 ? '#태그 입력' : ''}
                className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !url.trim() || !title.trim()}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
