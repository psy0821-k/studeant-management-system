import { z } from 'zod'

export interface ClassSchedule {
  id: string
  dayOfWeek: number // 0=일 ~ 6=토
  startTime: string // HH:mm
  endTime: string // HH:mm
}

export interface SchoolClass {
  id: string
  name: string
  subject: string
  teacher: string
  studentCount: number
  schedules: ClassSchedule[]
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const scheduleInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_PATTERN, '시작 시간 형식이 올바르지 않습니다.'),
    endTime: z.string().regex(TIME_PATTERN, '종료 시간 형식이 올바르지 않습니다.'),
  })
  .refine((schedule) => schedule.endTime > schedule.startTime, {
    message: '종료 시간은 시작 시간보다 늦어야 합니다.',
    path: ['endTime'],
  })

export const classInputSchema = z.object({
  name: z.string().trim().min(1, '반 이름을 입력해주세요.'),
  subject: z.string().trim().min(1, '과목을 입력해주세요.'),
  schedules: z.array(scheduleInputSchema),
})

export type ScheduleInput = z.infer<typeof scheduleInputSchema>
export type ClassInput = z.infer<typeof classInputSchema>

export const DAY_OF_WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
