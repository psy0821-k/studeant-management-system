import { z } from 'zod'

export interface SchoolClass {
  id: string
  name: string
  subject: string
  teacher: string
  schedule: string
  studentCount: number
}

export const classInputSchema = z.object({
  name: z.string().trim().min(1, '반 이름을 입력해주세요.'),
  subject: z.string().trim().min(1, '과목을 입력해주세요.'),
  schedule: z.string().trim(),
})

export type ClassInput = z.infer<typeof classInputSchema>
