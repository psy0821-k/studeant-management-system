import type { AttendanceRecord } from '../types/attendance'

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  { id: '1', studentName: '김민준', className: '수학 심화반', date: '2026-09-15', status: '출석' },
  { id: '2', studentName: '이서연', className: '영어 기초반', date: '2026-09-15', status: '지각' },
  { id: '3', studentName: '박도윤', className: '수학 심화반', date: '2026-09-15', status: '결석' },
  { id: '4', studentName: '최지우', className: '국어 논술반', date: '2026-09-15', status: '출석' },
  { id: '5', studentName: '정하은', className: '영어 기초반', date: '2026-09-15', status: '조퇴' },
]
