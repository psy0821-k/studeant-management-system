export type StudentStatus = '재원' | '휴원' | '퇴원'

export interface Student {
  id: string
  name: string
  grade: string
  className: string
  phone: string
  parentPhone: string
  status: StudentStatus
  enrolledAt: string
}
