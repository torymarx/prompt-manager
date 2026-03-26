'use client'

import { useState, useRef } from 'react'
import { Image as ImageIcon, Send, X, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface CommentFormProps {
  onSave: (content: string, imageUrl: string | null) => Promise<any>
}

export function CommentForm({ onSave }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage
        .from('thumbnails') // 기존 버킷 활용
        .upload(fileName, file)
      
      if (error) {
        toast.error('이미지 업로드에 실패했습니다.')
      } else {
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
        setImageUrl(publicUrl)
        toast.success('이미지가 첨부되었습니다.')
      }
    } catch {
      toast.error('오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !imageUrl) return

    setSaving(true)
    try {
      await onSave(content.trim(), imageUrl)
      setContent('')
      setImageUrl(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* 이미지 미리보기 */}
      {imageUrl && (
        <div className="relative inline-block">
          <img src={imageUrl} alt="첨부 이미지" className="h-20 w-20 object-cover rounded-lg border" />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="pr-10 bg-background"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
            title="이미지 첨부"
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
        <Button 
          type="submit" 
          size="icon" 
          disabled={saving || (!content.trim() && !imageUrl)}
          className="shrink-0"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  )
}
