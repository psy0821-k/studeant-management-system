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

interface CalendarNoteRow {
  id: string
  note_date: string
  content: string
}

function toCalendarNote(row: CalendarNoteRow) {
  return { id: row.id, date: row.note_date, content: row.content }
}

/**
 * 강사가 날짜별로 남기는 자유 텍스트 메모(학교 시험 일정, 학생 특이사항 등).
 * 수업 일정과 무관하며 학원 전체 공유(강사별 접근 제한 없음).
 */
router.get('/notes', async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string }
  if (!start || !end) {
    res.status(400).json({ error: 'start, end 쿼리 파라미터가 필요합니다.' })
    return
  }

  const result = await pool.query<CalendarNoteRow>(
    'SELECT id, note_date, content FROM calendar_notes WHERE note_date >= $1 AND note_date < $2 ORDER BY created_at',
    [start, end],
  )
  res.json(result.rows.map(toCalendarNote))
})

router.post('/notes', async (req, res) => {
  const { date, content } = req.body as { date?: string; content?: string }
  if (!date || !content?.trim()) {
    res.status(400).json({ error: '날짜와 내용은 필수입니다.' })
    return
  }

  const created = await pool.query<CalendarNoteRow>(
    `INSERT INTO calendar_notes (note_date, content, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, note_date, content`,
    [date, content.trim(), req.user!.id],
  )
  res.status(201).json(toCalendarNote(created.rows[0]))
})

router.put('/notes/:id', async (req, res) => {
  const { content } = req.body as { content?: string }
  if (!content?.trim()) {
    res.status(400).json({ error: '내용은 필수입니다.' })
    return
  }

  const updated = await pool.query<CalendarNoteRow>(
    `UPDATE calendar_notes SET content = $1 WHERE id = $2
     RETURNING id, note_date, content`,
    [content.trim(), req.params.id],
  )

  if (updated.rows.length === 0) {
    res.status(404).json({ error: '메모를 찾을 수 없습니다.' })
    return
  }

  res.json(toCalendarNote(updated.rows[0]))
})

router.delete('/notes/:id', async (req, res) => {
  const deleted = await pool.query('DELETE FROM calendar_notes WHERE id = $1 RETURNING id', [req.params.id])

  if (deleted.rows.length === 0) {
    res.status(404).json({ error: '메모를 찾을 수 없습니다.' })
    return
  }

  res.status(204).end()
})

export default router
