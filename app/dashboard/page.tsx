// 대시보드 Server Component - ClientWrapper를 통해 클라이언트 전용 렌더링
import { ClientWrapper } from './ClientWrapper'

export default function DashboardPage() {
  return <ClientWrapper />
}
