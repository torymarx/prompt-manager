import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 텍스트에서 #해시태그 추출 (한국어·영문·숫자·언더스코어 지원)
 * "#GPT", "#글쓰기", "#code_review" → ["GPT", "글쓰기", "code_review"]
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([가-힣a-zA-Z0-9_]+)/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1)))]
}
