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
import { MOCK_GRADES, MOCK_HOMEWORK } from '../mocks/grades'
import type { HomeworkStatus } from '../types/grade'

const HOMEWORK_BADGE_TONE: Record<HomeworkStatus, 'success' | 'info' | 'error'> = {
  완료: 'success',
  진행중: 'info',
  미제출: 'error',
}

function scoreTone(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

function GradesPage() {
  return (
    <div>
      <h2 className="text-page-title text-gray-900">성적/과제 관리</h2>
      <p className="mt-1 text-body-small text-gray-500">
        시험 성적과 과제 제출 현황을 확인합니다.
      </p>

      <section className="mt-6">
        <h3 className="text-section-title text-gray-900">성적</h3>
        <Card className="mt-3">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>이름</TableHeaderCell>
                <TableHeaderCell>과목</TableHeaderCell>
                <TableHeaderCell>시험명</TableHeaderCell>
                <TableHeaderCell>점수</TableHeaderCell>
                <TableHeaderCell>시험일</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_GRADES.map((grade) => (
                <TableRow key={grade.id}>
                  <TableCell className="text-body-medium text-gray-900">
                    {grade.studentName}
                  </TableCell>
                  <TableCell>{grade.subject}</TableCell>
                  <TableCell>{grade.examName}</TableCell>
                  <TableCell>
                    <Badge tone={scoreTone(grade.score)}>{grade.score}점</Badge>
                  </TableCell>
                  <TableCell className="text-caption text-gray-500">{grade.examDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="mt-8">
        <h3 className="text-section-title text-gray-900">과제</h3>
        <Card className="mt-3">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>이름</TableHeaderCell>
                <TableHeaderCell>과제명</TableHeaderCell>
                <TableHeaderCell>마감일</TableHeaderCell>
                <TableHeaderCell>상태</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_HOMEWORK.map((homework) => (
                <TableRow key={homework.id}>
                  <TableCell className="text-body-medium text-gray-900">
                    {homework.studentName}
                  </TableCell>
                  <TableCell>{homework.title}</TableCell>
                  <TableCell className="text-caption text-gray-500">{homework.dueDate}</TableCell>
                  <TableCell>
                    <Badge tone={HOMEWORK_BADGE_TONE[homework.status]}>{homework.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  )
}

export default GradesPage
