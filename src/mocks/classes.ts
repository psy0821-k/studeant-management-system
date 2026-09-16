import type { SchoolClass } from '../types/class'

export const MOCK_CLASSES: SchoolClass[] = [
  { id: '1', name: '수학 심화반', subject: '수학', teacher: '사유 선생님', schedule: '월·수·금 16:00-18:00', studentCount: 12 },
  { id: '2', name: '영어 기초반', subject: '영어', teacher: '사유 선생님', schedule: '화·목 15:00-17:00', studentCount: 10 },
  { id: '3', name: '국어 논술반', subject: '국어', teacher: '사유 선생님', schedule: '토 10:00-12:00', studentCount: 8 },
]
