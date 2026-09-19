import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
router.use(requireAuth)

interface GradeRow {
  id: string
  student_id: string
  subject: string
  exam_name: string
  exam_type: '학교시험' | '모의고사'
  score: string // numeric은 pg가 string으로 반환
  grade_level: number | null
  rank: number | null
  rank_in_grade: number | null
  exam_date: string
}

function toGrade(row: GradeRow) {
  return {
    id: row.id,
    studentId: row.student_id,
    subject: row.subject,
    examName: row.exam_name,
    examType: row.exam_type,
    score: Number(row.score),
    gradeLevel: row.grade_level,
    rank: row.rank,
    rankInGrade: row.rank_in_grade,
    examDate: row.exam_date,
  }
}

const SELECT_GRADE = `
  SELECT id, student_id, subject, exam_name, exam_type, score, grade_level, rank, rank_in_grade, exam_date
  FROM grades
`

interface GradePayload {
  studentId?: string
  examName?: string
  examType?: string
  score?: number
  gradeLevel?: number | null
  rank?: number | null
  rankInGrade?: number | null
  examDate?: string
}

const EXAM_TYPES = ['학교시험', '모의고사'] as const

function validatePayload(body: GradePayload) {
  const { studentId, examName, examType, score, gradeLevel, examDate } = body
  if (!studentId || !examName || !examType || !examDate) {
    return '학생, 시험명, 성적 유형, 시험일은 필수입니다.'
  }
  if (!EXAM_TYPES.includes(examType as (typeof EXAM_TYPES)[number])) {
    return '성적 유형은 학교시험 또는 모의고사만 입력할 수 있습니다.'
  }
  if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100) {
    return '점수는 0~100 사이여야 합니다.'
  }
  if (gradeLevel != null && (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 9)) {
    return '등급은 1~9 사이 정수여야 합니다.'
  }
  return null
}

// GET /api/grades?studentId=xxx&examType=학교시험
router.get('/', async (req, res) => {
  const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined
  const examType = typeof req.query.examType === 'string' ? req.query.examType : undefined

  if (!studentId) {
    res.status(400).json({ error: 'studentId 쿼리 파라미터는 필수입니다.' })
    return
  }

  const conditions = ['student_id = $1']
  const params: unknown[] = [studentId]
  if (examType) {
    params.push(examType)
    conditions.push(`exam_type = $${params.length}`)
  }

  const result = await pool.query<GradeRow>(
    `${SELECT_GRADE} WHERE ${conditions.join(' AND ')} ORDER BY exam_date ASC, created_at ASC`,
    params,
  )
  res.json(result.rows.map(toGrade))
})

// POST /api/grades
router.post('/', async (req, res) => {
  const body = req.body as GradePayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { studentId, examName, examType, score, gradeLevel, rank, rankInGrade, examDate } = body

  const created = await pool.query<{ id: string }>(
    `INSERT INTO grades (student_id, subject, exam_name, exam_type, score, grade_level, rank, rank_in_grade, exam_date)
     VALUES ($1, '수학', $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [studentId, examName, examType, score, gradeLevel ?? null, rank ?? null, rankInGrade ?? null, examDate],
  )

  const result = await pool.query<GradeRow>(`${SELECT_GRADE} WHERE id = $1`, [created.rows[0].id])
  res.status(201).json(toGrade(result.rows[0]))
})

// DELETE /api/grades/:id
router.delete('/:id', async (req, res) => {
  const deleted = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING id', [req.params.id])

  if (deleted.rows.length === 0) {
    res.status(404).json({ error: '성적을 찾을 수 없습니다.' })
    return
  }

  res.status(204).end()
})

export default router
