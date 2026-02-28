// ────────────────────────────────────────────────────────────
// 공통 타입 정의
// ────────────────────────────────────────────────────────────

/** 폴더 타입 - 자기 참조로 무한 중첩 가능 */
export type Folder = {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;      // null이면 최상위 폴더
  folder_type: 'prompt' | 'website'; // RPC(get_my_folders)로 조회, DB에 저장
  created_at: string;
  updated_at: string;
  children?: Folder[];           // 클라이언트에서 트리 구성 시 사용
};

/** 프롬프트 타입 */
export type Prompt = {
  id: string;
  user_id: string;
  folder_id: string | null; // null이면 루트(미분류)
  title: string;
  content: string; // 마크다운
  tags: string[];
  image_url: string | null;
  link_url: string | null;  // 참조 링크
  sort_order?: number;      // 수동 정렬 순서 (선택, DB default 0)
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
};

/** 검색 결과 타입 */
export type SearchResult = Prompt & {
  highlightedTitle?: string;
  highlightedContent?: string;
};

/** 뷰 모드 */
export type ViewMode = 'grid' | 'list';
