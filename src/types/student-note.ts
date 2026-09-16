export type StudentNoteType = '전달사항' | '특이사항'

export interface StudentNote {
  id: string
  studentName: string
  type: StudentNoteType
  content: string
  date: string
  resolved: boolean
}
