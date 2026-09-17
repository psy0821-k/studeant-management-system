import { z } from 'zod'

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

const PHONE_REGEX = /^01[0-9]-\d{3,4}-\d{4}$/

export const studentInputSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.'),
  grade: z.string().trim().min(1, '학년을 입력해주세요.'),
  gender: z.enum(['남', '여']),
  school: z.string().trim(),
  phone: z
    .string()
    .trim()
    .min(1, '연락처를 입력해주세요.')
    .regex(PHONE_REGEX, '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'),
  parentPhone: z
    .string()
    .trim()
    .min(1, '보호자 연락처를 입력해주세요.')
    .regex(PHONE_REGEX, '보호자 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'),
  status: z.enum(['재원', '휴원', '퇴원']),
  enrolledAt: z.string().min(1, '등록일을 선택해주세요.'),
})

export type StudentInput = z.infer<typeof studentInputSchema>
