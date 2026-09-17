import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
router.use(requireAuth)

interface ClassRow {
  id: string
  name: string
  subject: string
  teacher_name: string
  schedule: string | null
  student_count: string
}

function toClass(row: ClassRow) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    teacher: row.teacher_name,
    schedule: row.schedule ?? '',
    studentCount: Number(row.student_count),
  }
}

const SELECT_CLASS = `
  SELECT c.id, c.name, c.subject, u.name AS teacher_name, c.schedule,
         COUNT(s.id) AS student_count
  FROM classes c
  JOIN users u ON u.id = c.teacher_id
  LEFT JOIN students s ON s.class_id = c.id
`
const GROUP_BY_CLASS = 'GROUP BY c.id, u.name'

interface ClassPayload {
  name?: string
  subject?: string
  schedule?: string
}

function validatePayload(body: ClassPayload) {
  const { name, subject } = body
  if (!name || !subject) {
    return '반 이름, 과목은 필수입니다.'
  }
  return null
}

router.get('/', async (_req, res) => {
  const result = await pool.query<ClassRow>(`${SELECT_CLASS} ${GROUP_BY_CLASS} ORDER BY c.created_at DESC`)
  res.json(result.rows.map(toClass))
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

  res.json(toClass(schoolClass))
})

router.post('/', async (req, res) => {
  const body = req.body as ClassPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { name, subject, schedule } = body

  const created = await pool.query<{ id: string }>(
    `INSERT INTO classes (name, subject, teacher_id, schedule)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, subject, req.user!.id, schedule ?? null],
  )

  const result = await pool.query<ClassRow>(`${SELECT_CLASS} WHERE c.id = $1 ${GROUP_BY_CLASS}`, [
    created.rows[0].id,
  ])
  res.status(201).json(toClass(result.rows[0]))
})

router.put('/:id', async (req, res) => {
  const body = req.body as ClassPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { name, subject, schedule } = body

  const updated = await pool.query<{ id: string }>(
    `UPDATE classes
     SET name = $1, subject = $2, schedule = $3
     WHERE id = $4
     RETURNING id`,
    [name, subject, schedule ?? null, req.params.id],
  )

  if (updated.rows.length === 0) {
    res.status(404).json({ error: '반을 찾을 수 없습니다.' })
    return
  }

  const result = await pool.query<ClassRow>(`${SELECT_CLASS} WHERE c.id = $1 ${GROUP_BY_CLASS}`, [
    req.params.id,
  ])
  res.json(toClass(result.rows[0]))
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

  const deleted = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING id', [req.params.id])

  if (deleted.rows.length === 0) {
    res.status(404).json({ error: '반을 찾을 수 없습니다.' })
    return
  }

  res.status(204).end()
})

export default router
