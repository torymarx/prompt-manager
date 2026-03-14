// 웹사이트 URL에서 Microlink API로 실제 스크린샷과 제목 추출
// 스크린샷 우선 → og:image 폴백
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Microlink API 응답 타입
interface MicrolinkResponse {
  status: 'success' | 'fail'
  data: {
    title?: string
    image?: { url: string }
    screenshot?: { url: string }
  }
}

// 내부 네트워크 IP 패턴 (SSRF 방어)
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
]

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return !BLOCKED_PATTERNS.some((p) => p.test(url))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    // 인증된 사용자만 허용
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ thumbnail: null, title: null }, { status: 401 })
    }

    const { url } = await request.json() as { url?: string }

    if (!url || !isSafeUrl(url)) {
      return NextResponse.json({ thumbnail: null, title: null }, { status: 400 })
    }

    const apiUrl = new URL('https://api.microlink.io')
    apiUrl.searchParams.set('url', url)
    apiUrl.searchParams.set('screenshot', 'true') // 실제 브라우저 스크린샷 요청

    const headers: Record<string, string> = {}
    if (process.env.MICROLINK_API_KEY) {
      headers['x-api-key'] = process.env.MICROLINK_API_KEY
    }

    const res = await fetch(apiUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(15000), // 스크린샷 렌더링 대기 15초
    })

    if (!res.ok) {
      console.error('[fetch-thumbnail] Microlink 오류:', res.status)
      return NextResponse.json({ thumbnail: null, title: null })
    }

    const json = await res.json() as MicrolinkResponse

    if (json.status !== 'success') {
      return NextResponse.json({ thumbnail: null, title: null })
    }

    // 스크린샷 우선 → og:image 폴백
    const thumbnail = json.data.screenshot?.url ?? json.data.image?.url ?? null
    const title = json.data.title ?? null

    return NextResponse.json({ thumbnail, title })
  } catch (e) {
    console.error('[fetch-thumbnail]', e)
    return NextResponse.json({ thumbnail: null, title: null })
  }
}
