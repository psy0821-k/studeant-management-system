import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
router.use(requireAuth)

interface StudentRow {
  id: string
  name: string
  grade: string
  gender: '남' | '여'
  school: string | null
  class_id: string | null
  class_name: string | null
  phone: string | null
  parent_phone: string | null
  status: '재원' | '휴원' | '퇴원'
  enrolled_at: string
}

function toStudent(row: StudentRow) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    gender: row.gender,
    school: row.school,
    classId: row.class_id,
    className: row.class_name,
    phone: row.phone ?? '',
    parentPhone: row.parent_phone ?? '',
    status: row.status,
    enrolledAt: row.enrolled_at,
  }
}

const SELECT_STUDENT = `
  SELECT s.id, s.name, s.grade, s.gender, s.school, s.class_id, c.name AS class_name,
         s.phone, s.parent_phone, s.status, s.enrolled_at
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
`

interface StudentPayload {
  name?: string
  grade?: string
  gender?: string
  school?: string
  phone?: string
  parentPhone?: string
  status?: string
  enrolledAt?: string
}

function validatePayload(body: StudentPayload) {
  const { name, grade, gender, status, enrolledAt } = body
  if (!name || !grade || !gender || !status || !enrolledAt) {
    return '이름, 학년, 성별, 상태, 등록일은 필수입니다.'
  }
  if (gender !== '남' && gender !== '여') {
    return '성별은 남 또는 여만 입력할 수 있습니다.'
  }
  return null
}

router.get('/', async (req, res) => {
  const keyword = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  const result = keyword
    ? await pool.query<StudentRow>(
        `${SELECT_STUDENT} WHERE s.name ILIKE $1 ORDER BY s.created_at DESC`,
        [`%${keyword}%`],
      )
    : await pool.query<StudentRow>(`${SELECT_STUDENT} ORDER BY s.created_at DESC`)

  res.json(result.rows.map(toStudent))
})

router.get('/:id', async (req, res) => {
  const result = await pool.query<StudentRow>(`${SELECT_STUDENT} WHERE s.id = $1`, [req.params.id])
  const student = result.rows[0]

  if (!student) {
    res.status(404).json({ error: '학생을 찾을 수 없습니다.' })
    return
  }

  res.json(toStudent(student))
})

router.post('/', async (req, res) => {
  const body = req.body as StudentPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { name, grade, gender, school, phone, parentPhone, status, enrolledAt } = body

  const created = await pool.query<{ id: string }>(
    `INSERT INTO students (name, grade, gender, school, phone, parent_phone, status, enrolled_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [name, grade, gender, school ?? null, phone ?? null, parentPhone ?? null, status, enrolledAt, req.user!.id],
  )

  const result = await pool.query<StudentRow>(`${SELECT_STUDENT} WHERE s.id = $1`, [created.rows[0].id])
  res.status(201).json(toStudent(result.rows[0]))
})

router.put('/:id', async (req, res) => {
  const body = req.body as StudentPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { name, grade, gender, school, phone, parentPhone, status, enrolledAt } = body

  const updated = await pool.query<{ id: string }>(
    `UPDATE students
     SET name = $1, grade = $2, gender = $3, school = $4, phone = $5, parent_phone = $6, status = $7, enrolled_at = $8
     WHERE id = $9
     RETURNING id`,
    [name, grade, gender, school ?? null, phone ?? null, parentPhone ?? null, status, enrolledAt, req.params.id],
  )

  if (updated.rows.length === 0) {
    res.status(404).json({ error: '학생을 찾을 수 없습니다.' })
    return
  }

  const result = await pool.query<StudentRow>(`${SELECT_STUDENT} WHERE s.id = $1`, [req.params.id])
  res.json(toStudent(result.rows[0]))
})

router.delete('/:id', async (req, res) => {
  const deleted = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [req.params.id])

  if (deleted.rows.length === 0) {
    res.status(404).json({ error: '학생을 찾을 수 없습니다.' })
    return
  }

  res.status(204).end()
})

export default router
