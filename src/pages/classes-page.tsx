import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { EventInput } from '@fullcalendar/core'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import Badge from '../components/ui/badge'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Input from '../components/ui/input'
import { apiClient, ApiError } from '../lib/api-client'
import { classInputSchema, DAY_OF_WEEK_LABELS } from '../types/class'
import type { ClassInput, ScheduleInput, SchoolClass } from '../types/class'

const EMPTY_FORM: ClassInput = {
  name: '',
  subject: '',
  schedules: [],
}

const CLASS_COLORS = ['#5e64bb', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#0e9f6e']

function classColor(classId: string) {
  let hash = 0
  for (const char of classId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return CLASS_COLORS[hash % CLASS_COLORS.length]
}

function toCalendarEvents(classes: SchoolClass[]): EventInput[] {
  return classes.flatMap((schoolClass) =>
    schoolClass.schedules.map((schedule) => ({
      id: schedule.id,
      title: schoolClass.name,
      daysOfWeek: [schedule.dayOfWeek],
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      startRecur: '2000-01-01',
      color: classColor(schoolClass.id),
    })),
  )
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
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false)
  const [googleCalendarMessage, setGoogleCalendarMessage] = useState<string | null>(null)

  const calendarEvents = useMemo(() => toCalendarEvents(classes), [classes])

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

  async function loadGoogleCalendarStatus() {
    try {
      const data = await apiClient.get<{ connected: boolean }>('/auth/google-calendar/status')
      setIsGoogleCalendarConnected(data.connected)
    } catch {
      setIsGoogleCalendarConnected(false)
    }
  }

  useEffect(() => {
    loadClasses()
    loadGoogleCalendarStatus()

    const params = new URLSearchParams(window.location.search)
    const googleCalendarResult = params.get('googleCalendar')
    if (googleCalendarResult === 'connected') {
      setGoogleCalendarMessage('Google Calendar 연동이 완료되었습니다.')
      loadGoogleCalendarStatus()
    } else if (googleCalendarResult === 'error') {
      setGoogleCalendarMessage('Google Calendar 연동에 실패했습니다. 다시 시도해주세요.')
    }
    if (googleCalendarResult) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function handleConnectGoogleCalendar() {
    try {
      const data = await apiClient.get<{ url: string }>('/auth/google-calendar/connect')
      window.location.href = data.url
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Google Calendar 연동을 시작하지 못했습니다.')
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditForm(schoolClass: SchoolClass) {
    setEditingId(schoolClass.id)
    setForm({
      name: schoolClass.name,
      subject: schoolClass.subject,
      schedules: schoolClass.schedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })),
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  function toggleDay(dayOfWeek: number) {
    const exists = form.schedules.some((schedule) => schedule.dayOfWeek === dayOfWeek)
    if (exists) {
      setForm({ ...form, schedules: form.schedules.filter((schedule) => schedule.dayOfWeek !== dayOfWeek) })
    } else {
      setForm({
        ...form,
        schedules: [...form.schedules, { dayOfWeek, startTime: '16:00', endTime: '18:00' }].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek,
        ),
      })
    }
  }

  function updateScheduleTime(dayOfWeek: number, field: 'startTime' | 'endTime', value: string) {
    setForm({
      ...form,
      schedules: form.schedules.map((schedule) =>
        schedule.dayOfWeek === dayOfWeek ? { ...schedule, [field]: value } : schedule,
      ),
    })
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

  function scheduleFor(dayOfWeek: number): ScheduleInput | undefined {
    return form.schedules.find((schedule) => schedule.dayOfWeek === dayOfWeek)
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
        <div className="flex items-center gap-2">
          {isGoogleCalendarConnected ? (
            <Badge tone="success">Google Calendar 연동됨</Badge>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleConnectGoogleCalendar}>
              Google Calendar 연동
            </Button>
          )}
          <Button variant="primary" onClick={openCreateForm}>
            반 생성
          </Button>
        </div>
      </div>

      {googleCalendarMessage && (
        <p className="mt-3 text-body-small text-gray-600">{googleCalendarMessage}</p>
      )}

      {isFormOpen && (
        <Card className="mt-6 p-5">
          <h3 className="text-card-title text-gray-900">{editingId ? '반 정보 수정' : '새 반 생성'}</h3>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>

            <div>
              <p className="text-body-small font-medium text-gray-700">수업 요일 및 시간</p>
              <div className="mt-2 space-y-2">
                {DAY_OF_WEEK_LABELS.map((label, dayOfWeek) => {
                  const schedule = scheduleFor(dayOfWeek)
                  return (
                    <div key={dayOfWeek} className="flex items-center gap-3">
                      <label className="flex w-14 items-center gap-1.5 text-body-small text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!schedule}
                          onChange={() => toggleDay(dayOfWeek)}
                        />
                        {label}
                      </label>
                      {schedule && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={schedule.startTime}
                            onChange={(e) => updateScheduleTime(dayOfWeek, 'startTime', e.target.value)}
                          />
                          <span className="text-gray-400">~</span>
                          <Input
                            type="time"
                            value={schedule.endTime}
                            onChange={(e) => updateScheduleTime(dayOfWeek, 'endTime', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {formError && <p className="text-body-small text-error-500">{formError}</p>}
            <div className="flex gap-2">
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
                <dd className="text-right">
                  {schoolClass.schedules.length === 0
                    ? '미입력'
                    : schoolClass.schedules
                        .map((s) => `${DAY_OF_WEEK_LABELS[s.dayOfWeek]} ${s.startTime}-${s.endTime}`)
                        .join(', ')}
                </dd>
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

      {!isLoading && !error && classes.length > 0 && (
        <Card className="mt-6 p-5">
          <h3 className="text-card-title text-gray-900">주간 시간표</h3>
          <div className="mt-4">
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={false}
              allDaySlot={false}
              locale="ko"
              height="auto"
              slotMinTime="08:00:00"
              slotMaxTime="23:00:00"
              events={calendarEvents}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

export default ClassesPage
