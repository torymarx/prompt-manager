'use client'

// 사용설명서 모달 - 주요 기능 안내
import { useState } from 'react'
import { HelpCircle, FolderPlus, FileText, Search, Globe, Share2, Moon, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Section {
  icon: React.ReactNode
  title: string
  items: { label: string; desc: string }[]
}

const SECTIONS: Section[] = [
  {
    icon: <FolderPlus className="w-4 h-4 text-yellow-500" />,
    title: '폴더 관리',
    items: [
      { label: '폴더 만들기', desc: '사이드바 상단 + 버튼 클릭 → 폴더 이름 입력 → 프롬프트 폴더 / 웹사이트 폴더 선택 후 확인' },
      { label: '하위 폴더 만들기', desc: '폴더에 마우스를 올리면 나타나는 ··· 메뉴 → 하위 폴더 만들기' },
      { label: '이름 변경', desc: '폴더 ··· 메뉴 → 이름 변경' },
      { label: '순서 바꾸기', desc: '폴더 ··· 메뉴 → 위로 이동 / 아래로 이동' },
      { label: '폴더 삭제', desc: '폴더 ··· 메뉴 → 삭제 (하위 폴더도 함께 삭제, 프롬프트는 미분류로 이동)' },
    ],
  },
  {
    icon: <FileText className="w-4 h-4 text-blue-500" />,
    title: '프롬프트 관리',
    items: [
      { label: '새 프롬프트', desc: '오른쪽 상단 "새 프롬프트" 버튼 클릭 → 제목·내용·태그·폴더·이미지·링크 입력 후 저장' },
      { label: '내용 복사', desc: '프롬프트 카드 → 복사 버튼 클릭 (클립보드에 바로 복사)' },
      { label: '수정 / 삭제', desc: '프롬프트 카드 오른쪽 위 ··· 메뉴 → 수정 또는 삭제' },
      { label: '개별 공유', desc: '··· 메뉴 → 공유 → 링크가 클립보드에 복사됩니다 (만료 없음)' },
      { label: '순서 바꾸기', desc: '··· 메뉴 → 위로 이동 / 아래로 이동' },
      { label: '해시태그 자동 추출', desc: '내용에 #태그 형식으로 입력하면 저장 시 자동으로 태그에 추가됩니다' },
      { label: 'AI 키워드 추출', desc: '에디터에서 제목·내용 입력 후 잠시 기다리면 AI가 핵심 키워드를 자동 제안합니다' },
    ],
  },
  {
    icon: <Search className="w-4 h-4 text-purple-500" />,
    title: '검색',
    items: [
      { label: '전체 검색', desc: '상단 검색창에 키워드 입력 → 제목·내용에서 실시간 검색' },
      { label: '태그 검색', desc: '#태그이름 형식으로 입력 → 해당 태그를 가진 프롬프트만 표시' },
    ],
  },
  {
    icon: <Globe className="w-4 h-4 text-green-500" />,
    title: '웹사이트 북마크',
    items: [
      { label: '웹사이트 폴더', desc: '폴더 생성 시 "웹사이트 폴더" 선택 → 웹사이트 북마크 전용 폴더' },
      { label: '북마크 추가', desc: 'URL 입력 → 썸네일·제목 자동 가져오기 → 저장' },
      { label: '사이트 열기', desc: '북마크 카드 → 링크 클릭 또는 새 탭에서 열기' },
    ],
  },
  {
    icon: <Share2 className="w-4 h-4 text-orange-500" />,
    title: '전체 컬렉션 공유',
    items: [
      { label: '공유 시작', desc: '상단 "전체 공유" 버튼 클릭 → 링크 자동 생성 + 클립보드 복사 (2일 후 자동 만료)' },
      { label: '링크 재복사', desc: '공유 중일 때 "공유중" 버튼 클릭 → 링크 다시 복사' },
      { label: '공유 중지', desc: '"공유중" 버튼 옆 X 클릭 → 즉시 공유 종료 (링크 무효화)' },
      { label: '공유 페이지', desc: '공유 받은 사람은 읽기 전용으로 전체 프롬프트 조회 및 복사 가능 (수정 불가)' },
    ],
  },
  {
    icon: <Moon className="w-4 h-4 text-slate-500" />,
    title: '기타',
    items: [
      { label: '다크 모드', desc: '상단 오른쪽 달 아이콘 클릭 → 라이트 / 다크 / 시스템 테마 전환' },
      { label: '그리드 / 리스트 뷰', desc: '오른쪽 상단 뷰 전환 버튼으로 카드 크기 변경' },
      { label: '사이드바 접기', desc: '사이드바 오른쪽 가장자리 화살표 버튼으로 접기 / 펼치기' },
    ],
  },
]

function SectionBlock({ section }: { section: Section }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {section.icon}
          {section.title}
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        }
      </button>

      {open && (
        <ul className="divide-y">
          {section.items.map((item) => (
            <li key={item.label} className="px-4 py-2.5 flex gap-3 text-sm">
              <span className="font-medium shrink-0 w-32 text-foreground">{item.label}</span>
              <span className="text-muted-foreground leading-relaxed">{item.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function HelpModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="사용설명서"
      >
        <HelpCircle className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="w-5 h-5" />
              사용설명서
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            {SECTIONS.map((s) => (
              <SectionBlock key={s.title} section={s} />
            ))}
          </div>

          <p className={cn(
            'text-xs text-center text-muted-foreground pt-2 border-t mt-2'
          )}>
            © {new Date().getFullYear()} Naku Lab Studio · naku.lab.studio@kakao.com
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
