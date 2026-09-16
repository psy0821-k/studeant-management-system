export type PaymentStatus = '완납' | '미납' | '부분납'

export interface PaymentRecord {
  id: string
  studentName: string
  className: string
  item: string
  amount: number
  dueDate: string
  status: PaymentStatus
}
