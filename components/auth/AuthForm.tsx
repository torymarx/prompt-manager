'use client'

// 로그인 / 회원가입 공통 폼 컴포넌트
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Lock, BrainCircuit } from 'lucide-react'

type Mode = 'login' | 'signup'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      // 로그인 처리
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      // 회원가입 처리
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('가입 확인 이메일을 발송했습니다. 이메일을 확인해 주세요!')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <BrainCircuit className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">프롬프트 매니저</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? '계정에 로그인하세요' : '무료로 시작하세요'}
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>

          {/* 에러/성공 메시지 */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-md">
              {message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'login' ? '로그인' : '회원가입'}
          </Button>
        </form>

        {/* 페이지 전환 링크 */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === 'login' ? (
            <>
              계정이 없으신가요?{' '}
              <a href="/signup" className="text-primary font-medium hover:underline">
                회원가입
              </a>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{' '}
              <a href="/login" className="text-primary font-medium hover:underline">
                로그인
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
