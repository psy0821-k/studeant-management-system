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

export type HomeworkStatus = '완료' | '진행중' | '미제출'

export interface HomeworkRecord {
  id: string
  studentName: string
  title: string
  dueDate: string
  status: HomeworkStatus
}
