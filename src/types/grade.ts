import { z } from 'zod'

export type ExamType = '학교시험' | '모의고사'

export interface GradeRecord {
  id: string
  studentId: string
  subject: string
  examName: string
  examType: ExamType
  score: number
  gradeLevel: number | null
  rank: number | null
  rankInGrade: number | null
  examDate: string
}

// 이슈 4(상태 순환)도 계속 사용할 상태 값 — 유지
export type HomeworkStatus = '완료' | '진행중' | '미제출'

export interface HomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  status: HomeworkStatus
}

export interface HomeworkRecord {
  id: string
  classId: string | null
  className: string | null
  studentId: string | null
  studentName: string | null
  title: string
  createdAt: string
  submissions: HomeworkSubmission[]
}

// 과제 등록 폼 입력 — 반/학생 중 정확히 하나만 채워야 함(XOR)을 superRefine으로 검증한다.
export const homeworkInputSchema = z
  .object({
    targetType: z.enum(['class', 'student']),
    classId: z.string().nullable(),
    studentId: z.string().nullable(),
    title: z.string().trim().min(1, '과제명을 입력해주세요.'),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'class' && !value.classId) {
      ctx.addIssue({ code: 'custom', message: '반을 선택해주세요.', path: ['classId'] })
    }
    if (value.targetType === 'student' && !value.studentId) {
      ctx.addIssue({ code: 'custom', message: '학생을 선택해주세요.', path: ['studentId'] })
    }
  })

export type HomeworkInput = z.infer<typeof homeworkInputSchema>
