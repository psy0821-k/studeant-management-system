export type AttendanceStatus = '출석' | '지각' | '조퇴' | '결석'

export interface AttendanceRecord {
  id: string
  studentName: string
  className: string
  date: string
  status: AttendanceStatus
}
