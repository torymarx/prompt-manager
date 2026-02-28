// AI 핵심 키워드 추출 API
// 제목·내용을 분석해 가장 핵심적인 한국어 단어 하나를 반환
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    // 인증된 사용자만 허용 (API 키 남용 방지)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ keyword: null }, { status: 401 })
    }

    const { title, content } = await request.json() as { title?: string; content?: string }

    const text = [title, content].filter(Boolean).join('\n')
    if (!text.trim()) {
      return NextResponse.json({ keyword: null }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `다음 프롬프트의 핵심 주제를 나타내는 한국어 단어를 정확히 하나만 답하세요.
영어 내용이라도 반드시 한국어로 번역해서 답하세요.
설명 없이 단어 하나만 답하세요. (예: 번역, 요약, 코딩, 글쓰기, 분석)

제목: ${title ?? ''}
내용: ${content?.slice(0, 500) ?? ''}`,
        },
      ],
    })

    const keyword = (message.content[0] as { type: string; text: string }).text
      .trim()
      .replace(/[^\uAC00-\uD7A3a-zA-Z0-9_]/g, '') // 특수문자 제거
      .slice(0, 20) // 최대 20자

    if (!keyword) {
      return NextResponse.json({ keyword: null })
    }

    return NextResponse.json({ keyword })
  } catch (e) {
    console.error('[extract-keyword]', e)
    return NextResponse.json({ keyword: null }, { status: 500 })
  }
}
