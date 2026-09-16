import type { StudentNote } from '../types/student-note'

export const MOCK_STUDENT_NOTES: StudentNote[] = [
  {
    id: '1',
    studentName: '김민준',
    type: '전달사항',
    content: '다음 시간에 지난주 숙제 검사 꼭 할 것',
    date: '2026-09-15',
    resolved: false,
  },
  {
    id: '2',
    studentName: '박도윤',
    type: '특이사항',
    content: '가족 여행으로 인한 보강 필요',
    date: '2026-09-15',
    resolved: false,
  },
  {
    id: '3',
    studentName: '정하은',
    type: '특이사항',
    content: '숙제 미제출로 인한 추가 문제 20개 부여',
    date: '2026-09-15',
    resolved: false,
  },
  {
    id: '4',
    studentName: '이서연',
    type: '전달사항',
    content: '학부모님께 다음 달 시간표 변경 안내 필요',
    date: '2026-09-14',
    resolved: false,
  },
]
