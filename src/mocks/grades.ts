import type { GradeRecord, HomeworkRecord } from '../types/grade'

export const MOCK_GRADES: GradeRecord[] = [
  { id: '1', studentName: '김민준', subject: '수학', examName: '9월 모의고사', score: 92, examDate: '2026-09-05' },
  { id: '2', studentName: '이서연', subject: '영어', examName: '9월 모의고사', score: 78, examDate: '2026-09-05' },
  { id: '3', studentName: '박도윤', subject: '수학', examName: '9월 모의고사', score: 65, examDate: '2026-09-05' },
  { id: '4', studentName: '최지우', subject: '국어', examName: '9월 모의고사', score: 88, examDate: '2026-09-05' },
]

export const MOCK_HOMEWORK: HomeworkRecord[] = [
  { id: '1', studentName: '김민준', title: '수학 익힘책 3단원', dueDate: '2026-09-16', status: '완료' },
  { id: '2', studentName: '이서연', title: '영어 단어 100개 암기', dueDate: '2026-09-17', status: '진행중' },
  { id: '3', studentName: '박도윤', title: '수학 익힘책 3단원', dueDate: '2026-09-16', status: '미제출' },
  { id: '4', studentName: '최지우', title: '독서록 작성', dueDate: '2026-09-18', status: '완료' },
]
