'use client'

// 프롬프트 생성/수정 모달 - 서식 툴바 + 편집 모드
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  Hash, Plus,
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
  image_urls: [] as string[],
  link_url: '',
  folder_id: null as string | null,
  disable_share: false,
}

export function PromptEditor({
  open, onClose, onSave, folders, currentFolderId, editTarget
}: PromptEditorProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM, folder_id: currentFolderId })
  const [tagInput, setTagInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [thumbnailTab, setThumbnailTab] = useState<'url' | 'file'>('url')
  const [uploading, setUploading] = useState(false)
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
        image_urls: editTarget.image_urls || (editTarget.image_url ? [editTarget.image_url] : []),
        link_url: editTarget.link_url || '',
        folder_id: editTarget.folder_id,
        disable_share: editTarget.disable_share || false,
      })
    } else {
      setForm({ ...EMPTY_FORM, folder_id: currentFolderId })
    }
    setTagInput('')
  }, [editTarget, currentFolderId, open])

  const addTag = () => {
    const input = tagInput.trim()
    if (!input) return
    
    // 공백으로 분리하여 여러 태그를 추출 (이미 있는 태그 제외)
    const newTags = input.split(/\s+/).filter(t => t && !form.tags.includes(t))
    
    if (newTags.length > 0) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, ...newTags] }))
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

  // 이미지 파일들 압축 후 Supabase Storage 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    setUploading(true)
    let uploadedUrls: string[] = []
    
    try {
      for (const file of files) {
        const compressed = await compressImage(file)
        const fileName = `${crypto.randomUUID()}.jpg`
        const { error } = await supabase.storage
          .from('thumbnails')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        
        if (error) {
          toast.error(`"${file.name}" 업로드에 실패했습니다.`)
        } else {
          const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
          uploadedUrls.push(publicUrl)
        }
      }

      if (uploadedUrls.length > 0) {
        setForm((p) => {
          const nextUrls = [...p.image_urls, ...uploadedUrls]
          return { 
            ...p, 
            image_urls: nextUrls,
            // 첫 번째 이미지를 대표 썸네일로 설정 (기존 호환성)
            image_url: p.image_url || nextUrls[0] 
          }
        })
        toast.success(`${uploadedUrls.length}개의 이미지가 업로드되었습니다.`)
      }
    } catch (err) {
      toast.error('이미지 처리 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setForm(p => {
      const nextUrls = p.image_urls.filter((_, i) => i !== index)
      return {
        ...p,
        image_urls: nextUrls,
        image_url: nextUrls[0] || ''
      }
    })
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return

    // 분류(폴더)가 지정되지 않았을 때 확인 메시지
    if (!form.folder_id) {
      if (!confirm('폴더(분류)를 지정하지 않았습니다.\n이대로 저장하시겠습니까?')) {
        return
      }
    }

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
      image_urls: form.image_urls.length > 0 ? form.image_urls : null,
      link_url: form.link_url.trim() || null,
      folder_id: form.folder_id,
      disable_share: form.disable_share,
      is_public: false,
      share_token: null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 sm:rounded-2xl z-[100] border-none">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg">{editTarget ? '프롬프트 수정' : '새 프롬프트 만들기'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4">
            {/* 제목 */}
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="프롬프트 제목을 입력하세요"
                className="h-11 sm:h-9 text-base sm:text-sm"
              />
            </div>

            {/* 폴더 선택 + 참조 링크 (모바일 1열, SM이상 2열) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label>폴더</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 sm:py-2 text-base sm:text-sm"
                  value={form.folder_id || ''}
                  onChange={(e) => setForm((p) => ({ ...p, folder_id: e.target.value || null }))}
                >
                  <option value="">미분류 (루트)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>참조 링크 (선택)</Label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={form.link_url}
                    onChange={(e) => setForm((p) => ({ ...p, link_url: e.target.value }))}
                    placeholder="https://example.com"
                    className="pl-8 h-11 sm:h-9 text-base sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 내용 - 편집 에디터 */}
            <div className="space-y-1.5">
              <Label>내용 * (마크다운 지원)</Label>

              {/* 서식 툴바 - 모바일에서 터치 타겟 크게 */}
              <div className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-md border bg-muted/30 overflow-x-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0"
                  title="굵게"
                  onClick={() => insertMarkdown('**', '**', '굵은 텍스트')}
                >
                  <Bold className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0"
                  title="기울임"
                  onClick={() => insertMarkdown('*', '*', '기울임 텍스트')}
                >
                  <Italic className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0"
                  title="인라인 코드"
                  onClick={() => insertMarkdown('`', '`', '코드')}
                >
                  <Code className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </Button>
                <div className="w-px h-5 bg-border mx-0.5 sm:mx-1 shrink-0" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0"
                  title="제목 (H2)"
                  onClick={() => insertMarkdown('\n## ', '', '제목')}
                >
                  <Heading2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0"
                  title="목록"
                  onClick={() => insertMarkdown('\n- ', '', '항목')}
                >
                  <List className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </Button>
                <div className="w-px h-5 bg-border mx-0.5 sm:mx-1 shrink-0" />
                <button
                  type="button"
                  className="h-9 sm:h-7 px-2 sm:px-2 text-xs font-mono text-muted-foreground hover:text-foreground active:text-foreground hover:bg-muted rounded transition-colors shrink-0"
                  title="코드 블록"
                  onClick={() => insertMarkdown('\n```\n', '\n```', '코드 블록')}
                >
                  {'```'}
                </button>
              </div>

              {/* 에디터 영역 */}
              <div className="rounded-md border overflow-hidden">
                <Textarea
                  ref={textareaRef}
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="마크다운으로 프롬프트를 작성하세요..."
                  className="min-h-[200px] sm:min-h-[280px] font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0"
                />
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
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      // Assuming addTag is updated to handle space-separated input
                      addTag()
                    }
                  }}
                  placeholder="태그 입력 (공백으로 구분 가능)"
                  className="h-11 sm:h-9 text-base sm:text-sm"
                />
                <Button type="button" variant="outline" onClick={addTag} className="h-11 sm:h-9 shrink-0">추가</Button>
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
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (urlInput.trim()) {
                        setForm(p => {
                          const nextUrls = [...p.image_urls, urlInput.trim()]
                          return { ...p, image_urls: nextUrls, image_url: p.image_url || nextUrls[0] }
                        })
                        setUrlInput('')
                      }
                    }}
                  >
                    추가
                  </Button>
                </div>
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
                      : <><Upload className="w-3.5 h-3.5" /> 파일 선택 (다중 가능)</>
                    }
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              )}

              {/* 이미지 갤러리 미리보기 */}
              {form.image_urls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-3">
                  {form.image_urls.map((url, index) => (
                    <div key={index} className="relative group aspect-square rounded-lg border overflow-hidden bg-muted">
                      <img
                        src={url}
                        alt={`이미지 ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.src = 'https://placehold.co/400x400?text=Error'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-destructive/90 text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 text-center font-medium">
                          대표 썸네일
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 옵션 영역 (저장/취소 위) */}
        <div className="px-4 sm:px-6 py-3 border-t bg-muted/30 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="disable-share"
              checked={form.disable_share}
              onChange={(e) => setForm(p => ({ ...p, disable_share: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="disable-share" className="text-sm cursor-pointer select-none font-medium">
              공유 제외 (체크 시 모든 스토어/링크 공유 금지)
            </Label>
          </div>
        </div>

        <DialogFooter className="border-t px-4 sm:px-6 py-3 sm:py-4 shrink-0 flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-9 flex-1 sm:flex-none">취소</Button>
          <Button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.content.trim() || saving}
            className="h-11 sm:h-9 flex-1 sm:flex-none"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editTarget ? '저장' : '만들기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
