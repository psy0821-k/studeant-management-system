import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { listGoogleCalendarEvents } from '../google-calendar.js'

const router = Router()
router.use(requireAuth)

interface ClassScheduleRow {
  class_id: string
  class_name: string
  day_of_week: number
  start_time: string
  end_time: string
}

const CLASS_COLORS = ['#5e64bb', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#0e9f6e']

function classColor(classId: string) {
  let hash = 0
  for (const char of classId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return CLASS_COLORS[hash % CLASS_COLORS.length]
}

/**
 * 대시보드 월간 달력용 통합 이벤트 목록. 자기 반 수업 일정(반복 이벤트)과
 * 연동한 Google Calendar의 실제 이벤트(시험 일정, 개인 일정 등)를 합쳐서 반환한다.
 */
router.get('/calendar-events', async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string }
  if (!start || !end) {
    res.status(400).json({ error: 'start, end 쿼리 파라미터가 필요합니다.' })
    return
  }

  const scheduleResult = await pool.query<ClassScheduleRow>(
    `SELECT cs.class_id, c.name AS class_name, cs.day_of_week, cs.start_time, cs.end_time
     FROM class_schedules cs
     JOIN classes c ON c.id = cs.class_id
     WHERE c.teacher_id = $1`,
    [req.user!.id],
  )

  const classEvents = scheduleResult.rows.map((row) => ({
    id: `class-${row.class_id}-${row.day_of_week}`,
    title: row.class_name,
    daysOfWeek: [row.day_of_week],
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    startRecur: '2000-01-01',
    color: classColor(row.class_id),
    source: 'class' as const,
  }))

  const googleEvents = await listGoogleCalendarEvents(req.user!.id, start, end)
  const googleEventsForCalendar = googleEvents.map((event) => ({
    id: `google-${event.id}`,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    color: '#8b5cf6',
    source: 'google' as const,
  }))

  res.json([...classEvents, ...googleEventsForCalendar])
})

export default router
