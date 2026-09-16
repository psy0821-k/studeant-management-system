export type StudentStatus = '재원' | '휴원' | '퇴원'
export type StudentGender = '남' | '여'

export interface Student {
  id: string
  name: string
  grade: string
  gender: StudentGender
  school: string | null
  classId: string | null
  className: string | null
  phone: string
  parentPhone: string
  status: StudentStatus
  enrolledAt: string
}

export interface StudentInput {
  name: string
  grade: string
  gender: StudentGender
  school: string
  phone: string
  parentPhone: string
  status: StudentStatus
  enrolledAt: string
}
