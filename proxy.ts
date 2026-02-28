// ────────────────────────────────────────────────────────────
// 미들웨어: 모든 요청에서 인증 세션을 갱신하고
// 비로그인 유저가 대시보드 접근 시 로그인 페이지로 리디렉션
// ────────────────────────────────────────────────────────────
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16: proxy.ts + export function proxy (기존 middleware.ts/function middleware는 deprecated)
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    // 세션 갱신 (필수: 이 호출을 생략하면 세션이 만료됨)
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    // Supabase 연결 오류 시 인증되지 않은 것으로 처리
    console.error('[proxy] Supabase auth error:', e)
    user = null
  }

  const { pathname } = request.nextUrl

  // 로그인하지 않은 유저가 대시보드 접근 → 로그인 페이지로
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 로그인한 유저가 루트 또는 로그인 페이지 접근 → 대시보드로
  if (user && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
