import Badge from '../components/ui/badge'
import Card from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui/table'
import { MOCK_PAYMENTS } from '../mocks/payments'
import type { PaymentStatus } from '../types/payment'

const STATUS_BADGE_TONE: Record<PaymentStatus, 'success' | 'error' | 'warning'> = {
  완납: 'success',
  미납: 'error',
  부분납: 'warning',
}

function formatAmount(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function PaymentsPage() {
  return (
    <div>
      <h2 className="text-page-title text-gray-900">수강료 관리</h2>
      <p className="mt-1 text-body-small text-gray-500">
        반별 수강료·교재비 청구 및 수납 현황입니다.
      </p>

      <Card className="mt-6">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>이름</TableHeaderCell>
              <TableHeaderCell>반</TableHeaderCell>
              <TableHeaderCell>항목</TableHeaderCell>
              <TableHeaderCell>금액</TableHeaderCell>
              <TableHeaderCell>납부 기한</TableHeaderCell>
              <TableHeaderCell>상태</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {MOCK_PAYMENTS.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-body-medium text-gray-900">
                  {payment.studentName}
                </TableCell>
                <TableCell>{payment.className}</TableCell>
                <TableCell>{payment.item}</TableCell>
                <TableCell>{formatAmount(payment.amount)}</TableCell>
                <TableCell className="text-caption text-gray-500">{payment.dueDate}</TableCell>
                <TableCell>
                  <Badge tone={STATUS_BADGE_TONE[payment.status]}>{payment.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

export default PaymentsPage
