// 루트 페이지: 미들웨어가 로그인 여부에 따라 /dashboard 또는 /login으로 리디렉션
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}
