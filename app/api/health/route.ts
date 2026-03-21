import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // 정적 캐시 방지 (매번 DB 호출)

export async function GET(request: Request) {
    try {
        // 보안 검증: Vercel Cron 또는 GitHub Actions에서 보낸 시크릿 확인
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        // 시크릿이 설정되어 있는데 일치하지 않는 경우만 차단 (유연한 대응)
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ status: 'error', message: 'Missing env vars' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // DB 활동성 보장을 위해 실제 쿼리 실행 (단순 헤더 체크보다 확실함)
        const { data, error } = await supabase
            .from('prompts')
            .select('id')
            .limit(1)

        if (error) {
            console.error('Health check error:', error)
            return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            status: 'active',
            db_connected: true,
            timestamp: new Date().toISOString(),
            message: 'Supabase activity maintained successfully.'
        })
    } catch (error) {
        return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 })
    }
}
