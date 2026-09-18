import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { deleteGoogleCalendarEvents, syncClassSchedulesToGoogleCalendar } from '../google-calendar.js'

const router = Router()
router.use(requireAuth)

interface ClassRow {
  id: string
  name: string
  subject: string
  teacher_name: string
  student_count: string
}

interface ScheduleRow {
  id: string
  class_id: string
  day_of_week: number
  start_time: string
  end_time: string
  google_event_id: string | null
}

interface ClassSchedule {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

function toSchedule(row: ScheduleRow): ClassSchedule {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  }
}

function toClass(row: ClassRow, schedules: ClassSchedule[]) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    teacher: row.teacher_name,
    studentCount: Number(row.student_count),
    schedules,
  }
}

const SELECT_CLASS = `
  SELECT c.id, c.name, c.subject, u.name AS teacher_name,
         COUNT(s.id) AS student_count
  FROM classes c
  JOIN users u ON u.id = c.teacher_id
  LEFT JOIN students s ON s.class_id = c.id
`
const GROUP_BY_CLASS = 'GROUP BY c.id, u.name'

async function fetchSchedulesByClassIds(classIds: string[]): Promise<Map<string, ClassSchedule[]>> {
  const map = new Map<string, ClassSchedule[]>()
  if (classIds.length === 0) return map

  const result = await pool.query<ScheduleRow>(
    'SELECT id, class_id, day_of_week, start_time, end_time, google_event_id FROM class_schedules WHERE class_id = ANY($1) ORDER BY day_of_week, start_time',
    [classIds],
  )
  for (const row of result.rows) {
    const list = map.get(row.class_id) ?? []
    list.push(toSchedule(row))
    map.set(row.class_id, list)
  }
  return map
}

interface SchedulePayload {
  dayOfWeek?: number
  startTime?: string
  endTime?: string
}

interface ValidatedSchedule {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface ClassPayload {
  name?: string
  subject?: string
  schedules?: SchedulePayload[]
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function validatePayload(body: ClassPayload) {
  const { name, subject, schedules } = body
  if (!name || !subject) {
    return '반 이름, 과목은 필수입니다.'
  }
  if (schedules) {
    for (const schedule of schedules) {
      if (
        typeof schedule.dayOfWeek !== 'number' ||
        schedule.dayOfWeek < 0 ||
        schedule.dayOfWeek > 6
      ) {
        return '요일 값이 올바르지 않습니다.'
      }
      if (!schedule.startTime || !TIME_PATTERN.test(schedule.startTime)) {
        return '시작 시간이 올바르지 않습니다.'
      }
      if (!schedule.endTime || !TIME_PATTERN.test(schedule.endTime)) {
        return '종료 시간이 올바르지 않습니다.'
      }
      if (schedule.endTime <= schedule.startTime) {
        return '종료 시간은 시작 시간보다 늦어야 합니다.'
      }
    }
  }
  return null
}

interface SyncScheduleResult {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  googleEventId: string | null
}

/**
 * 요일 단위로 기존 일정을 갱신/삭제/생성한다. 그대로 남는 요일은 google_event_id를
 * 보존해 Calendar 쪽 이벤트를 새로 만들지 않고 재사용한다.
 */
async function replaceSchedules(
  classId: string,
  schedules: ValidatedSchedule[],
  teacherId: string,
): Promise<SyncScheduleResult[]> {
  const existing = await pool.query<ScheduleRow>(
    'SELECT id, class_id, day_of_week, start_time, end_time, google_event_id FROM class_schedules WHERE class_id = $1',
    [classId],
  )

  const remainingDays = new Set(schedules.map((s) => s.dayOfWeek))
  const toRemove = existing.rows.filter((row) => !remainingDays.has(row.day_of_week))
  const removedEventIds = toRemove.map((row) => row.google_event_id).filter((id): id is string => !!id)

  if (removedEventIds.length > 0) {
    await deleteGoogleCalendarEvents(teacherId, removedEventIds)
  }
  if (toRemove.length > 0) {
    await pool.query(
      'DELETE FROM class_schedules WHERE id = ANY($1)',
      [toRemove.map((row) => row.id)],
    )
  }

  const results: SyncScheduleResult[] = []
  for (const schedule of schedules) {
    const existingRow = existing.rows.find((row) => row.day_of_week === schedule.dayOfWeek)

    if (existingRow) {
      await pool.query(
        'UPDATE class_schedules SET start_time = $1, end_time = $2 WHERE id = $3',
        [schedule.startTime, schedule.endTime, existingRow.id],
      )
      results.push({
        id: existingRow.id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        googleEventId: existingRow.google_event_id,
      })
    } else {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [classId, schedule.dayOfWeek, schedule.startTime, schedule.endTime],
      )
      results.push({
        id: inserted.rows[0].id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        googleEventId: null,
      })
    }
  }

  return results
}

router.get('/', async (_req, res) => {
  const result = await pool.query<ClassRow>(`${SELECT_CLASS} ${GROUP_BY_CLASS} ORDER BY c.created_at DESC`)
  const scheduleMap = await fetchSchedulesByClassIds(result.rows.map((row) => row.id))
  res.json(result.rows.map((row) => toClass(row, scheduleMap.get(row.id) ?? [])))
})

router.get('/:id', async (req, res) => {
  const result = await pool.query<ClassRow>(`${SELECT_CLASS} WHERE c.id = $1 ${GROUP_BY_CLASS}`, [
    req.params.id,
  ])
  const schoolClass = result.rows[0]

  if (!schoolClass) {
    res.status(404).json({ error: '반을 찾을 수 없습니다.' })
    return
  }

  const scheduleMap = await fetchSchedulesByClassIds([schoolClass.id])
  res.json(toClass(schoolClass, scheduleMap.get(schoolClass.id) ?? []))
})

router.post('/', async (req, res) => {
  const body = req.body as ClassPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { name, subject, schedules } = body

  const created = await pool.query<{ id: string }>(
    `INSERT INTO classes (name, subject, teacher_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [name, subject, req.user!.id],
  )
  const classId = created.rows[0].id

  if (schedules && schedules.length > 0) {
    const synced = await replaceSchedules(classId, schedules as ValidatedSchedule[], req.user!.id)
    await syncClassSchedulesToGoogleCalendar(req.user!.id, name!, synced)
  }

  const result = await pool.query<ClassRow>(`${SELECT_CLASS} WHERE c.id = $1 ${GROUP_BY_CLASS}`, [
    classId,
  ])
  const scheduleMap = await fetchSchedulesByClassIds([classId])
  res.status(201).json(toClass(result.rows[0], scheduleMap.get(classId) ?? []))
})

router.put('/:id', async (req, res) => {
  const body = req.body as ClassPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { name, subject, schedules } = body

  const updated = await pool.query<{ id: string }>(
    `UPDATE classes
     SET name = $1, subject = $2
     WHERE id = $3
     RETURNING id`,
    [name, subject, req.params.id],
  )

  if (updated.rows.length === 0) {
    res.status(404).json({ error: '반을 찾을 수 없습니다.' })
    return
  }

  const synced = await replaceSchedules(req.params.id, (schedules ?? []) as ValidatedSchedule[], req.user!.id)
  await syncClassSchedulesToGoogleCalendar(req.user!.id, name!, synced)

  const result = await pool.query<ClassRow>(`${SELECT_CLASS} WHERE c.id = $1 ${GROUP_BY_CLASS}`, [
    req.params.id,
  ])
  const scheduleMap = await fetchSchedulesByClassIds([req.params.id])
  res.json(toClass(result.rows[0], scheduleMap.get(req.params.id) ?? []))
})

router.delete('/:id', async (req, res) => {
  const assigned = await pool.query<{ count: string }>(
    'SELECT COUNT(*) FROM students WHERE class_id = $1',
    [req.params.id],
  )
  if (Number(assigned.rows[0].count) > 0) {
    res.status(400).json({ error: '배정된 학생이 있는 반은 삭제할 수 없습니다. 먼저 학생 배정을 해제해주세요.' })
    return
  }

  const classRow = await pool.query<{ teacher_id: string }>('SELECT teacher_id FROM classes WHERE id = $1', [
    req.params.id,
  ])
  const scheduleRows = await pool.query<{ google_event_id: string | null }>(
    'SELECT google_event_id FROM class_schedules WHERE class_id = $1',
    [req.params.id],
  )

  const deleted = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING id', [req.params.id])

  if (deleted.rows.length === 0) {
    res.status(404).json({ error: '반을 찾을 수 없습니다.' })
    return
  }

  const eventIds = scheduleRows.rows.map((row) => row.google_event_id).filter((id): id is string => !!id)
  if (classRow.rows[0] && eventIds.length > 0) {
    await deleteGoogleCalendarEvents(classRow.rows[0].teacher_id, eventIds)
  }

  res.status(204).end()
})

export default router
