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
import { MOCK_ATTENDANCE } from '../mocks/attendance'
import type { AttendanceStatus } from '../types/attendance'

const STATUS_BADGE_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'error'> = {
  출석: 'success',
  지각: 'warning',
  조퇴: 'warning',
  결석: 'error',
}

function AttendancePage() {
  return (
    <div>
      <h2 className="text-page-title text-gray-900">출결 관리</h2>
      <p className="mt-1 text-body-small text-gray-500">오늘의 출결 현황입니다.</p>

      <Card className="mt-6">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>이름</TableHeaderCell>
              <TableHeaderCell>반</TableHeaderCell>
              <TableHeaderCell>날짜</TableHeaderCell>
              <TableHeaderCell>상태</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {MOCK_ATTENDANCE.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="text-body-medium text-gray-900">
                  {record.studentName}
                </TableCell>
                <TableCell>{record.className}</TableCell>
                <TableCell className="text-caption text-gray-500">{record.date}</TableCell>
                <TableCell>
                  <Badge tone={STATUS_BADGE_TONE[record.status]}>{record.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

export default AttendancePage
