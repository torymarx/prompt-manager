// 컬렉션 전체 공유 API
// GET:    현재 공유 상태 조회
// POST:   공유 생성 (기존 공유 삭제 후 새로 생성 → 2일 갱신)
// DELETE: 공유 중지
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ share: null }, { status: 401 })

  const { data } = await supabase
    .from('collection_shares')
    .select('token, expires_at')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ share: data ?? null })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 기존 공유 삭제 후 새로 생성 (토큰 갱신 + 만료일 2일 리셋)
  await supabase.from('collection_shares').delete().eq('user_id', user.id)

  const { data, error } = await supabase
    .from('collection_shares')
    .insert({ user_id: user.id })
    .select('token, expires_at')
    .single()

  if (error) {
    console.error('[collection-share POST]', error)
    return NextResponse.json({ error: '공유 생성에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ share: data })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { error } = await supabase
    .from('collection_shares')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('[collection-share DELETE]', error)
    return NextResponse.json({ error: '공유 중지에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
