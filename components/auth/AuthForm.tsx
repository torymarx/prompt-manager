'use client'

// 로그인 / 회원가입 공통 폼 컴포넌트 (모바일 최적화)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Loader2, Mail, Lock, BrainCircuit, Eye, EyeOff } from 'lucide-react'

type Mode = 'login' | 'signup'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          setError('이미 사용 중인 이메일입니다.')
        } else {
          setError('회원가입에 실패했습니다. 입력 정보를 확인해주세요.')
        }
      } else {
        setMessage('가입 확인 이메일을 발송했습니다. 이메일을 확인해 주세요!')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 상단 우측 - 테마 토글 */}
      <div className="flex justify-end px-4 pt-4 shrink-0">
        <ThemeToggle />
      </div>

      {/* 중앙 폼 영역 - 모바일 상단 정렬, PC 중앙 정렬 */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 pt-8 sm:pt-0 pb-8">
        <div className="w-full max-w-sm sm:max-w-md">

          {/* 로고 */}
          <div className="flex flex-col items-center mb-8 sm:mb-10">
            <div className="flex items-center justify-center w-16 h-16 sm:w-14 sm:h-14 rounded-2xl bg-primary mb-4 shadow-lg">
              <BrainCircuit className="w-8 h-8 sm:w-7 sm:h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl sm:text-2xl font-bold tracking-tight">프롬프트 매니저</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {mode === 'login' ? '계정에 로그인하세요' : '무료로 시작하세요'}
            </p>
          </div>

          {/* 폼 카드 */}
          <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* 이메일 */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 sm:h-10 text-base sm:text-sm"
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                </div>
              </div>

              {/* 비밀번호 */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-11 h-12 sm:h-10 text-base sm:text-sm"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                  />
                  {/* 비밀번호 보기/숨기기 - 터치 타겟 44px */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-full px-3 flex items-center text-muted-foreground hover:text-foreground active:text-foreground transition-colors min-w-[44px]"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
                    }
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="text-xs text-muted-foreground">비밀번호는 최소 6자 이상이어야 합니다.</p>
                )}
              </div>

              {/* 에러/성공 메시지 */}
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg leading-relaxed">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-4 py-3 rounded-lg leading-relaxed">
                  {message}
                </div>
              )}

              {/* 제출 버튼 - 터치 타겟 48px */}
              <Button
                type="submit"
                className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium mt-1"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'login' ? '로그인' : '회원가입'}
              </Button>
            </form>
          </div>

          {/* 페이지 전환 링크 - 터치 영역 확보 */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'login' ? (
              <>
                계정이 없으신가요?{' '}
                <a
                  href="/signup"
                  className="text-primary font-medium hover:underline active:opacity-70 py-2 inline-block"
                >
                  회원가입
                </a>
              </>
            ) : (
              <>
                이미 계정이 있으신가요?{' '}
                <a
                  href="/login"
                  className="text-primary font-medium hover:underline active:opacity-70 py-2 inline-block"
                >
                  로그인
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
