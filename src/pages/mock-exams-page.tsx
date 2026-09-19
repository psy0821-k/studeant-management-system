import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import { apiClient } from '../lib/api-client'
import type { Student } from '../types/student'
import type { GradeRecord } from '../types/grade'

// 모의고사 입력 폼 상태 (student-detail-page.tsx의 gradeFormState 패턴 재사용)
interface MockExamFormState {
  examName: string
  score: string
  gradeLevel: string
  rank: string
  rankInGrade: string
  examDate: string
}

const EMPTY_FORM: MockExamFormState = {
  examName: '',
  score: '',
  gradeLevel: '',
  rank: '',
  rankInGrade: '',
  examDate: '',
}

function MockExamsPage() {
  // 1) 학생 목록 로드 — students-page.tsx와 동일 패턴
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  // 2) 선택된 학생의 모의고사 목록
  const [mockExams, setMockExams] = useState<GradeRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // 3) 입력 폼 상태
  const [form, setForm] = useState<MockExamFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiClient.get<Student[]>('/students').then(setStudents).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedStudentId) return
    apiClient
      .get<GradeRecord[]>(`/grades?studentId=${selectedStudentId}&examType=모의고사`)
      .then(setMockExams)
      .catch(() => setLoadError('모의고사 목록을 불러오지 못했습니다.'))
  }, [selectedStudentId])

  function handleFormChange(field: keyof MockExamFormState, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleAddMockExam(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!selectedStudentId) {
      setFormError('학생을 선택해주세요.')
      return
    }
    const score = Number(form.score)
    if (form.examName.trim() === '' || form.examDate === '') {
      setFormError('시험명과 시험일은 필수입니다.')
      return
    }
    if (Number.isNaN(score) || score < 0 || score > 100) {
      setFormError('점수는 0~100 사이로 입력해주세요.')
      return
    }
    setFormError(null)
    setIsSubmitting(true)
    try {
      const created = await apiClient.post<GradeRecord>('/grades', {
        studentId: selectedStudentId,
        examType: '모의고사',
        examName: form.examName,
        score,
        gradeLevel: form.gradeLevel ? Number(form.gradeLevel) : null,
        rank: form.rank ? Number(form.rank) : null,
        rankInGrade: form.rankInGrade ? Number(form.rankInGrade) : null,
        examDate: form.examDate,
      })
      setMockExams((prev) => [...prev, created])
      setForm(EMPTY_FORM)
    } catch {
      setFormError('모의고사 저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteMockExam(gradeId: string): Promise<void> {
    if (!confirm('이 모의고사 성적을 삭제하시겠습니까?')) return
    try {
      await apiClient.delete<void>(`/grades/${gradeId}`)
      setMockExams((prev) => prev.filter((exam) => exam.id !== gradeId))
    } catch {
      setLoadError('삭제 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  // 추이 그래프: mockExams.length > 1 일 때만 렌더 (student-detail-page.tsx 패턴과 동일)
  const examHistory = mockExams.map((exam) => ({ examName: exam.examName, score: exam.score }))

  return (
    <div>
      <h2 className="text-page-title text-gray-900">모의고사 관리</h2>
      <p className="mt-1 text-body-small text-gray-500">
        모의고사 성적을 입력·조회·삭제할 수 있습니다.
      </p>

      <Card className="mt-6 p-5">
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72"
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
        >
          <option value="">-- 학생 선택 --</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>

        {!selectedStudentId ? (
          <p className="mt-4 text-body-small text-gray-400">학생을 선택해주세요.</p>
        ) : (
          <>
            <form className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" onSubmit={handleAddMockExam}>
              <Input
                className="col-span-2 sm:col-span-1"
                placeholder="시험명 (예: 9월 모의고사)"
                value={form.examName}
                onChange={(e) => handleFormChange('examName', e.target.value)}
              />
              <Input
                placeholder="점수"
                inputMode="numeric"
                value={form.score}
                onChange={(e) => handleFormChange('score', e.target.value)}
              />
              <Input
                placeholder="등급"
                inputMode="numeric"
                value={form.gradeLevel}
                onChange={(e) => handleFormChange('gradeLevel', e.target.value)}
              />
              <Input
                placeholder="반석차"
                inputMode="numeric"
                value={form.rank}
                onChange={(e) => handleFormChange('rank', e.target.value)}
              />
              <Input
                placeholder="전교석차"
                inputMode="numeric"
                value={form.rankInGrade}
                onChange={(e) => handleFormChange('rankInGrade', e.target.value)}
              />
              <Input
                type="date"
                value={form.examDate}
                onChange={(e) => handleFormChange('examDate', e.target.value)}
              />
              <Button type="submit" size="sm" disabled={isSubmitting} className="col-span-2 sm:col-span-1">
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
              {formError && (
                <p className="col-span-2 text-body-small text-error-500 sm:col-span-3">{formError}</p>
              )}
            </form>

            <div className="mt-4 h-64">
              {examHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={examHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="examName" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#343875"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#343875' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-body-small text-gray-400">성적 데이터가 없습니다.</p>
              )}
            </div>

            {loadError && <p className="mt-2 text-body-small text-error-500">{loadError}</p>}

            <Table className="mt-4">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>시험명</TableHeaderCell>
                  <TableHeaderCell>점수</TableHeaderCell>
                  <TableHeaderCell>등급</TableHeaderCell>
                  <TableHeaderCell>반석차</TableHeaderCell>
                  <TableHeaderCell>전교석차</TableHeaderCell>
                  <TableHeaderCell>시험일</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {mockExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>{exam.examName}</TableCell>
                    <TableCell>{exam.score}</TableCell>
                    <TableCell className="text-caption text-gray-500">{exam.gradeLevel ?? '-'}</TableCell>
                    <TableCell className="text-caption text-gray-500">{exam.rank ?? '-'}</TableCell>
                    <TableCell className="text-caption text-gray-500">{exam.rankInGrade ?? '-'}</TableCell>
                    <TableCell className="text-caption text-gray-500">{exam.examDate}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMockExam(exam.id)}
                      >
                        삭제
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {mockExams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-body-small text-gray-400">
                      등록된 모의고사 성적이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </Card>
    </div>
  )
}

export default MockExamsPage
