import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/ui/badge'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Input from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui/table'
import { MOCK_STUDENTS } from '../mocks/students'
import type { StudentStatus } from '../types/student'

const STATUS_BADGE_TONE: Record<StudentStatus, 'success' | 'warning' | 'gray'> = {
  재원: 'success',
  휴원: 'warning',
  퇴원: 'gray',
}

function StudentsPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')

  const filteredStudents = useMemo(() => {
    const trimmed = keyword.trim()
    if (!trimmed) return MOCK_STUDENTS
    return MOCK_STUDENTS.filter(
      (student) =>
        student.name.includes(trimmed) || student.className.includes(trimmed),
    )
  }, [keyword])

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-page-title text-gray-900">학생 관리</h2>
          <p className="mt-1 text-body-small text-gray-500">
            총 {MOCK_STUDENTS.length}명의 학생을 관리하고 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">엑셀 가져오기</Button>
          <Button variant="secondary">엑셀 내보내기</Button>
          <Button variant="primary">학생 등록</Button>
        </div>
      </div>

      <Card className="mt-6">
        <div className="border-b border-gray-200 p-4">
          <Input
            placeholder="이름 또는 반으로 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="w-72"
          />
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>이름</TableHeaderCell>
              <TableHeaderCell>학년</TableHeaderCell>
              <TableHeaderCell>반</TableHeaderCell>
              <TableHeaderCell>연락처</TableHeaderCell>
              <TableHeaderCell>보호자 연락처</TableHeaderCell>
              <TableHeaderCell>상태</TableHeaderCell>
              <TableHeaderCell>등록일</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <TableCell className="text-body-medium text-gray-900">
                  {student.name}
                </TableCell>
                <TableCell>{student.grade}</TableCell>
                <TableCell>{student.className}</TableCell>
                <TableCell>{student.phone}</TableCell>
                <TableCell>{student.parentPhone}</TableCell>
                <TableCell>
                  <Badge tone={STATUS_BADGE_TONE[student.status]}>
                    {student.status}
                  </Badge>
                </TableCell>
                <TableCell>{student.enrolledAt}</TableCell>
              </TableRow>
            ))}
            {filteredStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-body-small text-gray-400">
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

export default StudentsPage
