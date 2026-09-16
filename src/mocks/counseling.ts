import type { CounselingRecord } from '../types/counseling'

export const MOCK_COUNSELING: CounselingRecord[] = [
  { id: '1', studentName: '김민준', date: '2026-09-01', topic: '학습 태도', summary: '집중력이 향상되고 있어 긍정적으로 평가됨.' },
  { id: '2', studentName: '박도윤', date: '2026-08-20', topic: '성적 상담', summary: '수학 심화 과정 어려움 호소, 보충 학습 권장.' },
  { id: '3', studentName: '정하은', date: '2026-08-15', topic: '진로 상담', summary: '희망 진로에 맞는 학습 방향 논의.' },
]
