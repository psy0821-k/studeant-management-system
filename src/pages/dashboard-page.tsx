import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import Badge from '../components/ui/badge'
import Card from '../components/ui/card'
import FlipDigits from '../components/flip-digits'
import CalendarNoteModal from '../components/calendar-note-modal'
import { MOCK_STUDENT_NOTES } from '../mocks/student-notes'
import { useClock } from '../lib/use-clock'
import { apiClient, ApiError } from '../lib/api-client'
import type { StudentNoteType } from '../types/student-note'
import type { CalendarNote } from '../types/calendar-note'

const NOTE_BADGE_TONE: Record<StudentNoteType, 'info' | 'warning'> = {
  전달사항: 'info',
  특이사항: 'warning',
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function toDateParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarEvents, setCalendarEvents] = useState<EventInput[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null)
  const [selectedNoteDate, setSelectedNoteDate] = useState<Date | null>(null)
  const now = useClock()

  async function loadCalendarEvents(start: Date, end: Date) {
    setVisibleRange({ start, end })
    try {
      const [scheduleEvents, notes] = await Promise.all([
        apiClient.get<EventInput[]>(
          `/dashboard/calendar-events?start=${start.toISOString()}&end=${end.toISOString()}`,
        ),
        apiClient.get<CalendarNote[]>(
          `/dashboard/notes?start=${toDateParam(start)}&end=${toDateParam(end)}`,
        ),
      ])
      const noteEvents: EventInput[] = notes.map((note) => ({
        id: `note-${note.id}`,
        title: note.content,
        start: note.date,
        allDay: true,
        color: '#f59e0b',
        source: 'note',
      }))
      setCalendarEvents([...scheduleEvents, ...noteEvents])
    } catch (err) {
      setCalendarError(err instanceof ApiError ? err.message : '달력 정보를 불러오지 못했습니다.')
    }
  }

  function handleNoteModalClosed() {
    setSelectedNoteDate(null)
  }

  function handleNoteChanged() {
    if (visibleRange) loadCalendarEvents(visibleRange.start, visibleRange.end)
  }

  const moveDate = (days: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + days)
      return next
    })
  }

  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const weekday = now.toLocaleDateString('ko-KR', { weekday: 'short' })

  const todayNotes = MOCK_STUDENT_NOTES.filter((note) => !note.resolved)
  const deliveryNotes = todayNotes.filter((note) => note.type === '전달사항')
  const specialNotes = todayNotes.filter((note) => note.type === '특이사항')

  return (
    <div>
      <div className="flex items-center gap-3">
        <h2 className="text-page-title text-gray-900">{formatDate(currentDate)}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => moveDate(-1)}
            aria-label="이전 날짜"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => moveDate(1)}
            aria-label="다음 날짜"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="min-h-[380px] p-5">
          <div className="mb-3 flex items-center gap-4 text-caption text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              수업 일정 (반별 색상)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
              Google Calendar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning-500" />
              메모 (날짜 클릭으로 추가)
            </span>
          </div>
          {calendarError && <p className="mb-3 text-body-small text-error-500">{calendarError}</p>}
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ko"
            height="auto"
            events={calendarEvents}
            datesSet={(info) => loadCalendarEvents(info.start, info.end)}
            dateClick={(info) => setSelectedNoteDate(info.date)}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="relative flex divide-x divide-gray-200 p-0">
            <span className="absolute right-3 top-2 text-caption text-gray-400">{weekday}</span>
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              <FlipDigits value={hours} className="text-display text-gray-900" />
              <span className="mt-1 text-caption text-gray-400">시</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              <FlipDigits value={minutes} className="text-display text-gray-900" />
              <span className="mt-1 text-caption text-gray-400">분</span>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-card-title text-gray-900">시간표</h3>
            <p className="mt-3 text-body-small text-gray-400">오늘 등록된 수업이 없습니다.</p>
          </Card>

          <Card className="p-4">
            <h3 className="text-card-title text-gray-900">quick menu</h3>
            <p className="mt-3 text-body-small text-gray-400">바로가기 메뉴가 이곳에 표시됩니다.</p>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-card-title text-gray-900">전달사항</h3>
          <div className="mt-3 space-y-3">
            {deliveryNotes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body-small text-gray-900">
                    <span className="font-medium">{note.studentName}</span> · {note.content}
                  </p>
                  <p className="mt-0.5 text-caption text-gray-400">{note.date}</p>
                </div>
                <Badge tone={NOTE_BADGE_TONE[note.type]}>{note.type}</Badge>
              </div>
            ))}
            {deliveryNotes.length === 0 && (
              <p className="py-4 text-center text-body-small text-gray-400">
                등록된 전달사항이 없습니다.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-card-title text-gray-900">특이사항</h3>
          <div className="mt-3 space-y-3">
            {specialNotes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body-small text-gray-900">
                    <span className="font-medium">{note.studentName}</span> · {note.content}
                  </p>
                  <p className="mt-0.5 text-caption text-gray-400">{note.date}</p>
                </div>
                <Badge tone={NOTE_BADGE_TONE[note.type]}>{note.type}</Badge>
              </div>
            ))}
            {specialNotes.length === 0 && (
              <p className="py-4 text-center text-body-small text-gray-400">
                등록된 특이사항이 없습니다.
              </p>
            )}
          </div>
        </Card>
      </div>

      {selectedNoteDate && (
        <CalendarNoteModal
          date={selectedNoteDate}
          onClose={handleNoteModalClosed}
          onChanged={handleNoteChanged}
        />
      )}
    </div>
  )
}

export default DashboardPage
