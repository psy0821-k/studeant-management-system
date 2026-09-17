import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import { apiClient, ApiError } from '../lib/api-client'
import { MOCK_GRADE_HISTORY } from '../mocks/student-grade-history'
import { MOCK_ATTENDANCE } from '../mocks/attendance'
import { MOCK_HOMEWORK } from '../mocks/grades'
import { MOCK_PAYMENTS } from '../mocks/payments'
import { MOCK_COUNSELING } from '../mocks/counseling'
import { MOCK_TEXTBOOKS } from '../mocks/textbooks'
import { studentInputSchema } from '../types/student'
import type { Student, StudentInput, StudentStatus } from '../types/student'
import type { AttendanceStatus } from '../types/attendance'
import type { HomeworkStatus } from '../types/grade'
import type { PaymentStatus } from '../types/payment'

const STATUS_BADGE_TONE: Record<StudentStatus, 'success' | 'warning' | 'gray'> = {
  재원: 'success',
  휴원: 'warning',
  퇴원: 'gray',
}

const ATTENDANCE_BADGE_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'error'> = {
  출석: 'success',
  지각: 'warning',
  조퇴: 'warning',
  결석: 'error',
}

const HOMEWORK_BADGE_TONE: Record<HomeworkStatus, 'success' | 'info' | 'error'> = {
  완료: 'success',
  진행중: 'info',
  미제출: 'error',
}

const PAYMENT_BADGE_TONE: Record<PaymentStatus, 'success' | 'error' | 'warning'> = {
  완납: 'success',
  미납: 'error',
  부분납: 'warning',
}

function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(id))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<StudentInput | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    apiClient
      .get<Student>(`/students/${id}`)
      .then(setStudent)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'error')
      })
      .finally(() => setIsLoading(false))
  }, [id])

  function startEdit() {
    if (!student) return
    setForm({
      name: student.name,
      grade: student.grade,
      gender: student.gender,
      school: student.school ?? '',
      phone: student.phone,
      parentPhone: student.parentPhone,
      status: student.status,
      enrolledAt: student.enrolledAt,
    })
    setFormError(null)
    setIsEditing(true)
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!form || !id) return
    setFormError(null)
    const result = studentInputSchema.safeParse(form)
    if (!result.success) {
      setFormError(result.error.issues[0].message)
      return
    }
    setIsSubmitting(true)
    try {
      const updated = await apiClient.put<Student>(`/students/${id}`, result.data)
      setStudent(updated)
      setIsEditing(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '수정에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm('이 학생을 삭제하시겠습니까?')) return
    await apiClient.delete(`/students/${id}`)
    navigate('/students', { replace: true })
  }

  if (isLoading) {
    return <p className="text-body text-gray-500">불러오는 중...</p>
  }

  if (loadError || !student) {
    return (
      <div>
        <p className="text-body text-gray-500">
          {loadError === 'not_found' ? '학생을 찾을 수 없습니다.' : '학생 정보를 불러오지 못했습니다.'}
        </p>
        <Link to="/students" className="mt-2 inline-block text-body-small text-primary-700">
          학생 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const gradeHistory = MOCK_GRADE_HISTORY[student.id] ?? []
  const attendance = MOCK_ATTENDANCE.filter((record) => record.studentName === student.name)
  const homework = MOCK_HOMEWORK.filter((record) => record.studentName === student.name)
  const payments = MOCK_PAYMENTS.filter((record) => record.studentName === student.name)
  const counseling = MOCK_COUNSELING.filter((record) => record.studentName === student.name)
  const textbooks = MOCK_TEXTBOOKS.filter((record) => record.studentName === student.name)

  return (
    <div>
      <Link to="/students" className="text-body-small text-gray-500 hover:text-gray-700">
        ← 학생 목록으로
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-page-title text-gray-900">{student.name}</h2>
          <Badge tone={STATUS_BADGE_TONE[student.status]}>{student.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={startEdit}>
            정보 수정
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            삭제
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-card-title text-gray-900">기본 정보</h3>
          {isEditing && form ? (
            <form className="mt-4 space-y-3" onSubmit={handleUpdate}>
              <Input
                placeholder="이름"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                placeholder="학년"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                required
              />
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as StudentInput['gender'] })}
              >
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
              <Input
                placeholder="학교명"
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
              />
              <Input
                placeholder="연락처"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                placeholder="보호자 연락처"
                value={form.parentPhone}
                onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
              />
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
              >
                <option value="재원">재원</option>
                <option value="휴원">휴원</option>
                <option value="퇴원">퇴원</option>
              </select>
              <Input
                type="date"
                value={form.enrolledAt}
                onChange={(e) => setForm({ ...form, enrolledAt: e.target.value })}
                required
              />
              {formError && <p className="text-body-small text-error-500">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? '저장 중...' : '저장'}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  취소
                </Button>
              </div>
            </form>
          ) : (
            <dl className="mt-4 space-y-2 text-body-small">
              <div className="flex justify-between">
                <dt className="text-gray-400">학년</dt>
                <dd className="text-gray-700">{student.grade}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">성별</dt>
                <dd className="text-gray-700">{student.gender}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">학교</dt>
                <dd className="text-gray-700">
                  {student.school ?? <span className="text-gray-400">미입력</span>}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">반</dt>
                <dd className="text-gray-700">
                  {student.className ?? <span className="text-gray-400">미배정</span>}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">연락처</dt>
                <dd className="text-gray-700">{student.phone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">보호자 연락처</dt>
                <dd className="text-gray-700">{student.parentPhone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">등록일</dt>
                <dd className="text-gray-700">{student.enrolledAt}</dd>
              </div>
            </dl>
          )}

          <h3 className="mt-6 text-card-title text-gray-900">사용 교재</h3>
          <div className="mt-3 space-y-3">
            {textbooks.map((textbook) => (
              <div key={textbook.id} className="border-b border-gray-100 pb-3 last:border-none">
                <p className="text-body-small font-medium text-gray-900">{textbook.title}</p>
                <p className="mt-0.5 text-caption text-gray-500">
                  진도: {textbook.progress} · 시작일: {textbook.startedAt}
                </p>
              </div>
            ))}
            {textbooks.length === 0 && (
              <p className="text-body-small text-gray-400">등록된 교재가 없습니다.</p>
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-card-title text-gray-900">성적 추이</h3>
          <div className="mt-4 h-64">
            {gradeHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gradeHistory}>
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
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-card-title text-gray-900">출결 현황</h3>
          <Table className="mt-3">
            <TableHead>
              <TableRow>
                <TableHeaderCell>날짜</TableHeaderCell>
                <TableHeaderCell>반</TableHeaderCell>
                <TableHeaderCell>상태</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="text-caption text-gray-500">{record.date}</TableCell>
                  <TableCell>{record.className}</TableCell>
                  <TableCell>
                    <Badge tone={ATTENDANCE_BADGE_TONE[record.status]}>{record.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {attendance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-body-small text-gray-400">
                    출결 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-5">
          <h3 className="text-card-title text-gray-900">과제 현황</h3>
          <Table className="mt-3">
            <TableHead>
              <TableRow>
                <TableHeaderCell>과제명</TableHeaderCell>
                <TableHeaderCell>마감일</TableHeaderCell>
                <TableHeaderCell>상태</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {homework.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.title}</TableCell>
                  <TableCell className="text-caption text-gray-500">{record.dueDate}</TableCell>
                  <TableCell>
                    <Badge tone={HOMEWORK_BADGE_TONE[record.status]}>{record.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {homework.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-body-small text-gray-400">
                    과제 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-5">
          <h3 className="text-card-title text-gray-900">수강료 현황</h3>
          <Table className="mt-3">
            <TableHead>
              <TableRow>
                <TableHeaderCell>항목</TableHeaderCell>
                <TableHeaderCell>금액</TableHeaderCell>
                <TableHeaderCell>상태</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.item}</TableCell>
                  <TableCell>{record.amount.toLocaleString('ko-KR')}원</TableCell>
                  <TableCell>
                    <Badge tone={PAYMENT_BADGE_TONE[record.status]}>{record.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-body-small text-gray-400">
                    수납 기록이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-5">
          <h3 className="text-card-title text-gray-900">상담 기록</h3>
          <div className="mt-3 space-y-3">
            {counseling.map((record) => (
              <div key={record.id} className="border-b border-gray-100 pb-3 last:border-none">
                <div className="flex items-center justify-between">
                  <p className="text-body-small text-primary-700">{record.topic}</p>
                  <span className="text-caption text-gray-400">{record.date}</span>
                </div>
                <p className="mt-1 text-body-small text-gray-600">{record.summary}</p>
              </div>
            ))}
            {counseling.length === 0 && (
              <p className="py-6 text-center text-body-small text-gray-400">
                상담 기록이 없습니다.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default StudentDetailPage
