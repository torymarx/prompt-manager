import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // 정적 캐시 방지 (매번 DB 호출)

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ status: 'error', message: 'Missing env vars' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // DB에 가벼운 읽기 요청을 보내 활동(Activity)을 유지합니다.
        const { count, error } = await supabase
            .from('prompts')
            .select('*', { count: 'exact', head: true })

        if (error) {
            console.error('Health check error:', error)
            return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            status: 'active',
            count,
            timestamp: new Date().toISOString(),
            schedule: '0 0 * * *',
            interval: 'once per day (Supabase pause prevention)',
        })
    } catch (error) {
        return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 })
    }
}
