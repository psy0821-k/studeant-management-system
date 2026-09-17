import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
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
import { apiClient, ApiError } from '../lib/api-client'
import { studentInputSchema } from '../types/student'
import type { Student, StudentInput, StudentStatus } from '../types/student'

const STATUS_BADGE_TONE: Record<StudentStatus, 'success' | 'warning' | 'gray'> = {
  재원: 'success',
  휴원: 'warning',
  퇴원: 'gray',
}

const STATUS_OPTIONS: StudentStatus[] = ['재원', '휴원', '퇴원']

const EMPTY_FORM: StudentInput = {
  name: '',
  grade: '',
  gender: '남',
  school: '',
  phone: '',
  parentPhone: '',
  status: '재원',
  enrolledAt: new Date().toISOString().slice(0, 10),
}

function StudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<StudentInput>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function loadStudents(q: string) {
    setIsLoading(true)
    setError(null)
    try {
      const path = q.trim() ? `/students?q=${encodeURIComponent(q.trim())}` : '/students'
      const data = await apiClient.get<Student[]>(path)
      setStudents(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '학생 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents(keyword)
    }, 250)
    return () => clearTimeout(timer)
  }, [keyword])

  function openCreateForm() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setIsFormOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const result = studentInputSchema.safeParse(form)
    if (!result.success) {
      setFormError(result.error.issues[0].message)
      return
    }
    setIsSubmitting(true)
    try {
      await apiClient.post<Student>('/students', result.data)
      setIsFormOpen(false)
      await loadStudents(keyword)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '학생 등록에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-page-title text-gray-900">학생 관리</h2>
          <p className="mt-1 text-body-small text-gray-500">
            총 {students.length}명의 학생을 관리하고 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">엑셀 가져오기</Button>
          <Button variant="secondary">엑셀 내보내기</Button>
          <Button variant="primary" onClick={openCreateForm}>
            학생 등록
          </Button>
        </div>
      </div>

      {isFormOpen && (
        <Card className="mt-6 p-5">
          <h3 className="text-card-title text-gray-900">새 학생 등록</h3>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              placeholder="이름"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              placeholder="학년 (예: 중2)"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              required
            />
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={form.enrolledAt}
              onChange={(e) => setForm({ ...form, enrolledAt: e.target.value })}
              required
            />
            {formError && (
              <p className="sm:col-span-2 text-body-small text-error-500">{formError}</p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '등록 중...' : '등록'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-6">
        <div className="border-b border-gray-200 p-4">
          <Input
            placeholder="이름으로 검색"
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
            {students.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <TableCell className="text-body-medium text-gray-900">
                  {student.name}
                  <span className="ml-1 text-caption text-gray-400">{student.gender}</span>
                </TableCell>
                <TableCell>{student.grade}</TableCell>
                <TableCell>
                  {student.className ?? <span className="text-gray-400">미배정</span>}
                </TableCell>
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
            {!isLoading && !error && students.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-body-small text-gray-400">
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-body-small text-gray-400">
                  불러오는 중...
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-body-small text-error-500">
                  {error}
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
