import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Input from '../components/ui/input'
import { apiClient, ApiError } from '../lib/api-client'
import { classInputSchema } from '../types/class'
import type { ClassInput, SchoolClass } from '../types/class'

const EMPTY_FORM: ClassInput = {
  name: '',
  subject: '',
  schedule: '',
}

function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClassInput>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function loadClasses() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<SchoolClass[]>('/classes')
      setClasses(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '반 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditForm(schoolClass: SchoolClass) {
    setEditingId(schoolClass.id)
    setForm({ name: schoolClass.name, subject: schoolClass.subject, schedule: schoolClass.schedule })
    setFormError(null)
    setIsFormOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const result = classInputSchema.safeParse(form)
    if (!result.success) {
      setFormError(result.error.issues[0].message)
      return
    }
    setIsSubmitting(true)
    try {
      if (editingId) {
        await apiClient.put<SchoolClass>(`/classes/${editingId}`, result.data)
      } else {
        await apiClient.post<SchoolClass>('/classes', result.data)
      }
      setIsFormOpen(false)
      await loadClasses()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '반 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 반을 삭제하시겠습니까?')) return
    try {
      await apiClient.delete(`/classes/${id}`)
      await loadClasses()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '반 삭제에 실패했습니다.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-page-title text-gray-900">반 관리</h2>
          <p className="mt-1 text-body-small text-gray-500">
            총 {classes.length}개 반을 운영하고 있습니다.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateForm}>
          반 생성
        </Button>
      </div>

      {isFormOpen && (
        <Card className="mt-6 p-5">
          <h3 className="text-card-title text-gray-900">{editingId ? '반 정보 수정' : '새 반 생성'}</h3>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              placeholder="반 이름 (예: 수학 심화반)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              placeholder="과목"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
            <Input
              placeholder="일정 (예: 월·수·금 16:00-18:00)"
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              className="sm:col-span-2"
            />
            {formError && (
              <p className="sm:col-span-2 text-body-small text-error-500">{formError}</p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading && <p className="mt-6 text-body-small text-gray-400">불러오는 중...</p>}
      {error && <p className="mt-6 text-body-small text-error-500">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((schoolClass) => (
          <Card key={schoolClass.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-card-title text-gray-900">{schoolClass.name}</h3>
                <p className="mt-1 text-body-small text-gray-500">{schoolClass.subject}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" onClick={() => openEditForm(schoolClass)}>
                  수정
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(schoolClass.id)}>
                  삭제
                </Button>
              </div>
            </div>
            <dl className="mt-4 space-y-1.5 text-body-small text-gray-600">
              <div className="flex justify-between">
                <dt className="text-gray-400">담당</dt>
                <dd>{schoolClass.teacher}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">일정</dt>
                <dd>{schoolClass.schedule || '미입력'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">학생 수</dt>
                <dd>{schoolClass.studentCount}명</dd>
              </div>
            </dl>
          </Card>
        ))}
        {!isLoading && !error && classes.length === 0 && (
          <p className="text-body-small text-gray-400">등록된 반이 없습니다.</p>
        )}
      </div>
    </div>
  )
}

export default ClassesPage
