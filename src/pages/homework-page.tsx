import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Badge from '../components/ui/badge'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Input from '../components/ui/input'
import { apiClient, ApiError } from '../lib/api-client'
import { homeworkInputSchema } from '../types/grade'
import type { HomeworkInput, HomeworkRecord, HomeworkStatus, HomeworkSubmission } from '../types/grade'
import type { SchoolClass } from '../types/class'
import type { Student } from '../types/student'

const EMPTY_FORM: HomeworkInput = {
  targetType: 'class',
  classId: null,
  studentId: null,
  title: '',
}

const HOMEWORK_BADGE_TONE: Record<HomeworkStatus, 'success' | 'info' | 'error'> = {
  완료: 'success',
  진행중: 'info',
  미제출: 'error',
}

// 배지 클릭 시 순환할 다음 상태 매핑 (미제출 → 진행중 → 완료 → 미제출)
const NEXT_HOMEWORK_STATUS: Record<HomeworkStatus, HomeworkStatus> = {
  미제출: '진행중',
  진행중: '완료',
  완료: '미제출',
}

function HomeworkPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [homeworkList, setHomeworkList] = useState<HomeworkRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<HomeworkInput>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null)
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null)

  async function loadHomework() {
    const data = await apiClient.get<HomeworkRecord[]>('/homework')
    setHomeworkList(data)
  }

  async function loadAll() {
    setIsLoading(true)
    setError(null)
    try {
      const [classData, studentData] = await Promise.all([
        apiClient.get<SchoolClass[]>('/classes'),
        apiClient.get<Student[]>('/students'),
      ])
      setClasses(classData)
      setStudents(studentData)
      await loadHomework()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '과제 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function changeTargetType(targetType: HomeworkInput['targetType']) {
    setForm({ ...form, targetType, classId: null, studentId: null })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitSuccessMessage(null)
    const result = homeworkInputSchema.safeParse(form)
    if (!result.success) {
      setFormError(result.error.issues[0].message)
      return
    }
    setIsSubmitting(true)
    try {
      const payload =
        result.data.targetType === 'class'
          ? { classId: result.data.classId, title: result.data.title }
          : { studentId: result.data.studentId, title: result.data.title }
      const created = await apiClient.post<HomeworkRecord>('/homework', payload)
      setHomeworkList((prev) => [...prev, created])
      // 반 전체 등록 시 제출 기록이 몇 명에게 생성됐는지 안내한다
      if (created.className) {
        setSubmitSuccessMessage(
          `${created.className} ${created.submissions.length}명에게 과제가 등록되었습니다.`,
        )
      }
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '과제 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        '이 과제와 연결된 모든 학생의 제출 기록도 함께 삭제됩니다. 삭제하시겠습니까?',
      )
    )
      return
    setDeleteError(null)
    try {
      await apiClient.delete(`/homework/${id}`)
      setHomeworkList((prev) => prev.filter((homework) => homework.id !== id))
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : '과제 삭제에 실패했습니다.')
    }
  }

  // homeworkId의 과제에서 submissionId에 해당하는 제출 항목의 상태만 nextStatus로 교체한 새 목록을 반환한다
  function applySubmissionStatus(
    list: HomeworkRecord[],
    homeworkId: string,
    submissionId: string,
    nextStatus: HomeworkStatus,
  ): HomeworkRecord[] {
    return list.map((homework) =>
      homework.id === homeworkId
        ? {
            ...homework,
            submissions: homework.submissions.map((item) =>
              item.id === submissionId ? { ...item, status: nextStatus } : item,
            ),
          }
        : homework,
    )
  }

  // 제출 현황 배지 클릭 시 다음 상태로 순환하고, 실패하면 이전 상태로 되돌린다
  async function handleSubmissionStatusClick(
    homeworkId: string,
    submission: HomeworkSubmission,
  ): Promise<void> {
    const previousStatus = submission.status
    const nextStatus = NEXT_HOMEWORK_STATUS[previousStatus]
    setStatusUpdateError(null)
    setHomeworkList((prev) => applySubmissionStatus(prev, homeworkId, submission.id, nextStatus))
    try {
      await apiClient.put(`/homework/submissions/${submission.id}`, { status: nextStatus })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '상태 변경에 실패했습니다.'
      setHomeworkList((prev) => applySubmissionStatus(prev, homeworkId, submission.id, previousStatus))
      setStatusUpdateError(message)
    }
  }

  return (
    <div>
      <h2 className="text-page-title text-gray-900">과제 관리</h2>
      <p className="mt-1 text-body-small text-gray-500">
        반 전체 또는 개별 학생에게 과제를 등록하고 제출 현황을 확인합니다.
      </p>
      <p className="mt-1 text-body-small text-gray-400">
        성적 관리는 학생 상세 페이지 또는 모의고사 관리 메뉴에서 확인할 수 있습니다.
      </p>

      <Card className="mt-6 p-5">
        <h3 className="text-card-title text-gray-900">과제 등록</h3>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-body-small text-gray-700">
              <input
                type="radio"
                name="targetType"
                checked={form.targetType === 'class'}
                onChange={() => changeTargetType('class')}
              />
              반 전체
            </label>
            <label className="flex items-center gap-1.5 text-body-small text-gray-700">
              <input
                type="radio"
                name="targetType"
                checked={form.targetType === 'student'}
                onChange={() => changeTargetType('student')}
              />
              개별 학생 등록
            </label>
          </div>

          {form.targetType === 'class' ? (
            <div>
              <label htmlFor="homework-class-select" className="text-body-small text-gray-700">
                반 선택
              </label>
              <select
                id="homework-class-select"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.classId ?? ''}
                onChange={(e) => setForm({ ...form, classId: e.target.value || null })}
              >
                <option value="">선택 안 함</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="homework-student-select" className="text-body-small text-gray-700">
                학생 선택
              </label>
              <select
                id="homework-student-select"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.studentId ?? ''}
                onChange={(e) => setForm({ ...form, studentId: e.target.value || null })}
              >
                <option value="">선택 안 함</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            placeholder="과제명"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          {formError && <p className="text-body-small text-error-500">{formError}</p>}
          {submitSuccessMessage && (
            <p className="text-body-small text-success-500">{submitSuccessMessage}</p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </Button>
        </form>
      </Card>

      {isLoading && <p className="mt-6 text-body-small text-gray-400">불러오는 중...</p>}
      {error && <p className="mt-6 text-body-small text-error-500">{error}</p>}
      {deleteError && <p className="mt-6 text-body-small text-error-500">{deleteError}</p>}
      {statusUpdateError && (
        <p className="mt-6 text-body-small text-error-500">{statusUpdateError}</p>
      )}

      <div className="mt-6 space-y-4">
        {homeworkList.map((homework) => (
          <Card key={homework.id} data-testid="homework-item" className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-card-title text-gray-900">{homework.title}</h3>
                <p className="mt-1 text-body-small text-gray-500">
                  {homework.className ?? homework.studentName}
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(homework.id)}>
                삭제
              </Button>
            </div>

            <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
              {homework.submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="flex items-center justify-between text-body-small text-gray-700"
                >
                  <span>{submission.studentName}</span>
                  <Badge
                    role="button"
                    tabIndex={0}
                    tone={HOMEWORK_BADGE_TONE[submission.status]}
                    className="cursor-pointer select-none"
                    onClick={() => handleSubmissionStatusClick(homework.id, submission)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSubmissionStatusClick(homework.id, submission)
                      }
                    }}
                  >
                    {submission.status}
                  </Badge>
                </li>
              ))}
              {homework.submissions.length === 0 && (
                <li className="text-body-small text-gray-400">제출 현황이 없습니다.</li>
              )}
            </ul>
          </Card>
        ))}
        {!isLoading && !error && homeworkList.length === 0 && (
          <p className="text-body-small text-gray-400">등록된 과제가 없습니다.</p>
        )}
      </div>
    </div>
  )
}

export default HomeworkPage
