'use client'

// 프롬프트 생성/수정 모달 - 마크다운 분할 에디터 + 서식 툴바
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  X, Loader2, Upload, Link,
  Bold, Italic, Code, List, Heading2,
  LayoutPanelLeft, Maximize2, Hash, Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, extractHashtags } from '@/lib/utils'
import type { Folder, Prompt } from '@/lib/types'

interface PromptEditorProps {
  open: boolean
  onClose: () => void
  onSave: (values: Omit<Prompt, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  folders: Folder[]
  currentFolderId: string | null
  editTarget?: Prompt | null
}

const EMPTY_FORM = {
  title: '',
  content: '',
  tags: [] as string[],
  image_url: '',
  link_url: '',
  folder_id: null as string | null,
}

// 에디터 뷰 모드: 편집만 | 분할 | 미리보기만
type EditorMode = 'edit' | 'split' | 'preview'

export function PromptEditor({
  open, onClose, onSave, folders, currentFolderId, editTarget
}: PromptEditorProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM, folder_id: currentFolderId })
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [thumbnailTab, setThumbnailTab] = useState<'url' | 'file'>('url')
  const [uploading, setUploading] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('split')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // 제목·내용에서 자동 추출된 해시태그 (아직 태그 목록에 없는 것만)
  const detectedHashtags = useMemo(() => {
    const found = extractHashtags(`${form.title} ${form.content}`)
    return found.filter((t) => !form.tags.includes(t))
  }, [form.title, form.content, form.tags])

  // 해시태그 한 번에 전부 추가
  const addAllHashtags = () => {
    if (detectedHashtags.length === 0) return
    setForm((prev) => ({ ...prev, tags: [...prev.tags, ...detectedHashtags] }))
  }

  // 해시태그 하나 추가
  const addHashtag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
  }

  // 수정 시 기존 데이터로 초기화
  useEffect(() => {
    if (editTarget) {
      setForm({
        title: editTarget.title,
        content: editTarget.content,
        tags: editTarget.tags,
        image_url: editTarget.image_url || '',
        link_url: editTarget.link_url || '',
        folder_id: editTarget.folder_id,
      })
    } else {
      setForm({ ...EMPTY_FORM, folder_id: currentFolderId })
    }
    setTagInput('')
  }, [editTarget, currentFolderId, open])

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  // 마크다운 서식 삽입 헬퍼
  const insertMarkdown = useCallback((before: string, after = '', placeholder = '') => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = form.content.slice(start, end) || placeholder
    const newContent =
      form.content.slice(0, start) + before + selected + after + form.content.slice(end)
    setForm((p) => ({ ...p, content: newContent }))
    // 커서 위치 복원
    requestAnimationFrame(() => {
      textarea.focus()
      const newCursor = start + before.length + selected.length
      textarea.setSelectionRange(newCursor, newCursor)
    })
  }, [form.content])

  // 이미지를 Canvas로 리사이즈 + JPEG 압축 후 Blob 반환
  const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('압축 실패')),
          'image/jpeg',
          quality,
        )
      }
      img.onerror = reject
      img.src = objectUrl
    })

  // 이미지 파일 압축 후 Supabase Storage 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const fileName = `${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, compressed, { contentType: 'image/jpeg' })
      if (error) {
        toast.error('이미지 업로드에 실패했습니다.')
      } else {
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
        setForm((p) => ({ ...p, image_url: publicUrl }))
        toast.success('이미지가 업로드되었습니다.')
      }
    } catch {
      toast.error('이미지 처리 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)

    // AI 핵심 키워드 자동 추출 (내용이 충분할 때)
    let finalTags = [...form.tags]
    if (form.content.trim().length > 30) {
      try {
        const res = await fetch('/api/extract-keyword', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, content: form.content }),
        })
        const { keyword } = await res.json() as { keyword: string | null }
        if (keyword && !finalTags.includes(keyword)) {
          finalTags = [...finalTags, keyword]
          toast.success(`AI 키워드 "${keyword}" 가 태그로 추가되었습니다.`)
        }
      } catch {
        // AI 추출 실패해도 저장은 계속 진행
      }
    }

    await onSave({
      title: form.title.trim(),
      content: form.content.trim(),
      tags: finalTags,
      image_url: form.image_url || null,
      link_url: form.link_url.trim() || null,
      folder_id: form.folder_id,
      is_public: false,
      share_token: null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{editTarget ? '프롬프트 수정' : '새 프롬프트 만들기'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* 제목 */}
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="프롬프트 제목을 입력하세요"
              />
            </div>

            {/* 폴더 선택 */}
            <div className="space-y-1.5">
              <Label>폴더</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.folder_id || ''}
                onChange={(e) => setForm((p) => ({ ...p, folder_id: e.target.value || null }))}
              >
                <option value="">미분류 (루트)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* 내용 - 분할 에디터 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>내용 * (마크다운 지원)</Label>
                {/* 뷰 모드 전환 */}
                <div className="flex items-center rounded-md border overflow-hidden">
                  <Button
                    type="button"
                    variant={editorMode === 'edit' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none h-7 px-2 text-xs gap-1"
                    onClick={() => setEditorMode('edit')}
                    title="편집만"
                  >
                    <Code className="w-3 h-3" /> 편집
                  </Button>
                  <Button
                    type="button"
                    variant={editorMode === 'split' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none h-7 px-2 text-xs gap-1 border-x"
                    onClick={() => setEditorMode('split')}
                    title="분할 화면"
                  >
                    <LayoutPanelLeft className="w-3 h-3" /> 분할
                  </Button>
                  <Button
                    type="button"
                    variant={editorMode === 'preview' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none h-7 px-2 text-xs gap-1"
                    onClick={() => setEditorMode('preview')}
                    title="미리보기만"
                  >
                    <Maximize2 className="w-3 h-3" /> 미리보기
                  </Button>
                </div>
              </div>

              {/* 서식 툴바 (편집 모드일 때만 표시) */}
              {editorMode !== 'preview' && (
                <div className="flex items-center gap-1 p-1 rounded-md border bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="굵게 (Ctrl+B)"
                    onClick={() => insertMarkdown('**', '**', '굵은 텍스트')}
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="기울임 (Ctrl+I)"
                    onClick={() => insertMarkdown('*', '*', '기울임 텍스트')}
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="인라인 코드"
                    onClick={() => insertMarkdown('`', '`', '코드')}
                  >
                    <Code className="w-3.5 h-3.5" />
                  </Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="제목 (H2)"
                    onClick={() => insertMarkdown('\n## ', '', '제목')}
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="목록"
                    onClick={() => insertMarkdown('\n- ', '', '항목')}
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    type="button"
                    className="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    title="코드 블록"
                    onClick={() => insertMarkdown('\n```\n', '\n```', '코드 블록')}
                  >
                    {'```'}
                  </button>
                </div>
              )}

              {/* 에디터 영역 */}
              <div className={cn(
                'grid rounded-md border overflow-hidden',
                editorMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'
              )}>
                {/* 편집기 */}
                {editorMode !== 'preview' && (
                  <Textarea
                    ref={textareaRef}
                    value={form.content}
                    onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder="마크다운으로 프롬프트를 작성하세요..."
                    className={cn(
                      'min-h-[280px] font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0',
                      editorMode === 'split' && 'border-r'
                    )}
                  />
                )}

                {/* 미리보기 */}
                {editorMode !== 'edit' && (
                  <div className="min-h-[280px] p-4 prose prose-sm dark:prose-invert max-w-none overflow-auto bg-muted/20">
                    {form.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {form.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground text-sm">미리보기할 내용이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 해시태그 자동 감지 제안 */}
            {detectedHashtags.length > 0 && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Hash className="w-3.5 h-3.5" />
                    내용에서 해시태그 발견
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2 gap-1"
                    onClick={addAllHashtags}
                  >
                    <Plus className="w-3 h-3" /> 모두 추가
                  </Button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {detectedHashtags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addHashtag(tag)}
                      className="flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-full px-2.5 py-1 transition-colors"
                    >
                      <Hash className="w-3 h-3" />{tag}
                      <Plus className="w-3 h-3 ml-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 태그 */}
            <div className="space-y-1.5">
              <Label>태그</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                  }}
                  placeholder="태그 입력 후 Enter (예: GPT, 글쓰기)"
                />
                <Button type="button" variant="outline" onClick={addTag}>추가</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="rounded hover:bg-muted">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 참조 링크 */}
            <div className="space-y-1.5">
              <Label>참조 링크 (선택)</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm((p) => ({ ...p, link_url: e.target.value }))}
                  placeholder="https://example.com"
                  className="pl-8"
                />
              </div>
            </div>

            {/* 썸네일 - URL 또는 파일 업로드 */}
            <div className="space-y-1.5">
              <Label>썸네일 이미지 (선택)</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={thumbnailTab === 'url' ? 'secondary' : 'ghost'}
                  className="gap-1.5"
                  onClick={() => setThumbnailTab('url')}
                >
                  <Link className="w-3.5 h-3.5" /> URL 입력
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={thumbnailTab === 'file' ? 'secondary' : 'ghost'}
                  className="gap-1.5"
                  onClick={() => setThumbnailTab('file')}
                >
                  <Upload className="w-3.5 h-3.5" /> 파일 업로드
                </Button>
              </div>

              {thumbnailTab === 'url' ? (
                <Input
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="https://example.com/image.png"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 업로드 중...</>
                      : <><Upload className="w-3.5 h-3.5" /> 파일 선택</>
                    }
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {form.image_url && thumbnailTab === 'file' && (
                    <span className="text-xs text-green-600">업로드 완료</span>
                  )}
                </div>
              )}

              {/* 미리보기 */}
              {form.image_url && (
                <div className="relative mt-2 inline-block">
                  <img
                    src={form.image_url}
                    alt="썸네일 미리보기"
                    className="h-24 rounded-md object-cover border"
                    onError={(e) => {
                      const el = e.currentTarget
                      el.style.display = 'none'
                      el.nextElementSibling?.classList.add('hidden')
                      toast.error('이미지를 불러올 수 없습니다. URL을 확인해주세요.')
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, image_url: '' }))}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4 shrink-0">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.content.trim() || saving}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editTarget ? '저장' : '만들기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
