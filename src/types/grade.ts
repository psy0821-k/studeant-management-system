export interface GradeRecord {
  id: string
  studentName: string
  subject: string
  examName: string
  score: number
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
