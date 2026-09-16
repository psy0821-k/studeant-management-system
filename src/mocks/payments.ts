import type { PaymentRecord } from '../types/payment'

export const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: '1', studentName: '김민준', className: '수학 심화반', item: '9월 수강료', amount: 250000, dueDate: '2026-09-10', status: '완납' },
  { id: '2', studentName: '이서연', className: '영어 기초반', item: '9월 수강료', amount: 220000, dueDate: '2026-09-10', status: '미납' },
  { id: '3', studentName: '박도윤', className: '수학 심화반', item: '교재비', amount: 35000, dueDate: '2026-09-12', status: '부분납' },
  { id: '4', studentName: '최지우', className: '국어 논술반', item: '9월 수강료', amount: 200000, dueDate: '2026-09-10', status: '완납' },
]
