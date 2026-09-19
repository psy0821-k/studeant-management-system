import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
router.use(requireAuth)

interface HomeworkRow {
  id: string
  class_id: string | null
  student_id: string | null
  title: string
  created_by: string
  created_at: string
  class_name: string | null
  student_name: string | null
}

interface SubmissionRow {
  id: string
  homework_id: string
  student_id: string
  student_name: string
  status: '완료' | '진행중' | '미제출'
}

interface HomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  status: '완료' | '진행중' | '미제출'
}

interface HomeworkWithSubmissions {
  id: string
  classId: string | null
  className: string | null
  studentId: string | null
  studentName: string | null
  title: string
  createdAt: string
  submissions: HomeworkSubmission[]
}

// SELECT_HOMEWORK: homework + (classId 등록이면) 반 이름, (studentId 등록이면) 학생 이름을 함께 조회
// classes.ts의 SELECT_CLASS(LEFT JOIN + GROUP BY)와 달리 homework는 1:1 스칼라 조인이라 GROUP BY 불필요
const SELECT_HOMEWORK = `
  SELECT h.id, h.class_id, h.student_id, h.title, h.created_by, h.created_at,
         c.name AS class_name, s.name AS student_name
  FROM homework h
  LEFT JOIN classes c ON c.id = h.class_id
  LEFT JOIN students s ON s.id = h.student_id
`

function toHomework(row: HomeworkRow, submissions: HomeworkSubmission[]): HomeworkWithSubmissions {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    studentId: row.student_id,
    studentName: row.student_name,
    title: row.title,
    createdAt: row.created_at,
    submissions,
  }
}

async function fetchSubmissionsByHomeworkIds(homeworkIds: string[]): Promise<Map<string, HomeworkSubmission[]>> {
  const map = new Map<string, HomeworkSubmission[]>()
  if (homeworkIds.length === 0) return map

  const result = await pool.query<SubmissionRow>(
    `SELECT hs.id, hs.homework_id, hs.student_id, s.name AS student_name, hs.status
     FROM homework_submissions hs
     JOIN students s ON s.id = hs.student_id
     WHERE hs.homework_id = ANY($1)
     ORDER BY s.name ASC`,
    [homeworkIds],
  )
  for (const row of result.rows) {
    const list = map.get(row.homework_id) ?? []
    list.push({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      status: row.status,
    })
    map.set(row.homework_id, list)
  }
  return map
}

interface HomeworkPayload {
  classId?: string | null
  studentId?: string | null
  title?: string
}

function validatePayload(body: HomeworkPayload): string | null {
  const { classId, studentId, title } = body
  const hasClassId = !!classId
  const hasStudentId = !!studentId

  if (hasClassId === hasStudentId) {
    return '반 또는 학생 중 정확히 하나만 선택해주세요.'
  }
  if (!title || title.trim().length === 0) {
    return '과제명을 입력해주세요.'
  }
  return null
}

// GET /api/homework
// 등록된 모든 과제 + 각 과제의 학생별 제출 현황(submissions)을 함께 반환한다.
// (40명 규모 목록 전체 조회이므로 페이지네이션 없음 — PRD Out of Scope와 일치)
router.get('/', async (_req, res) => {
  const result = await pool.query<HomeworkRow>(`${SELECT_HOMEWORK} ORDER BY h.created_at DESC`)
  const submissionMap = await fetchSubmissionsByHomeworkIds(result.rows.map((row) => row.id))
  res.json(result.rows.map((row) => toHomework(row, submissionMap.get(row.id) ?? [])))
})

// POST /api/homework
// body: { classId?: string, studentId?: string, title: string }
router.post('/', async (req, res) => {
  const body = req.body as HomeworkPayload
  const validationError = validatePayload(body)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  const { classId, studentId, title } = body

  if (classId) {
    const classResult = await pool.query('SELECT id FROM classes WHERE id = $1', [classId])
    if (classResult.rows.length === 0) {
      res.status(400).json({ error: '존재하지 않는 반입니다.' })
      return
    }
  }
  if (studentId) {
    const studentResult = await pool.query('SELECT id FROM students WHERE id = $1', [studentId])
    if (studentResult.rows.length === 0) {
      res.status(400).json({ error: '존재하지 않는 학생입니다.' })
      return
    }
  }

  const client = await pool.connect()
  let homeworkId: string
  try {
    await client.query('BEGIN')

    const created = await client.query<{ id: string }>(
      `INSERT INTO homework (class_id, student_id, title, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [classId ?? null, studentId ?? null, title!.trim(), req.user!.id],
    )
    homeworkId = created.rows[0].id

    if (classId) {
      await client.query(
        `INSERT INTO homework_submissions (homework_id, student_id)
         SELECT $1, id FROM students WHERE class_id = $2`,
        [homeworkId, classId],
      )
    } else {
      await client.query(
        `INSERT INTO homework_submissions (homework_id, student_id)
         VALUES ($1, $2)`,
        [homeworkId, studentId],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const result = await pool.query<HomeworkRow>(`${SELECT_HOMEWORK} WHERE h.id = $1`, [homeworkId])
  const submissionMap = await fetchSubmissionsByHomeworkIds([homeworkId])
  res.status(201).json(toHomework(result.rows[0], submissionMap.get(homeworkId) ?? []))
})

// DELETE /api/homework/:id
router.delete('/:id', async (req, res) => {
  const client = await pool.connect()
  let deletedId: string | undefined
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM homework_submissions WHERE homework_id = $1', [req.params.id])
    const deleted = await client.query<{ id: string }>('DELETE FROM homework WHERE id = $1 RETURNING id', [
      req.params.id,
    ])
    deletedId = deleted.rows[0]?.id
    await client.query(deletedId ? 'COMMIT' : 'ROLLBACK')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  if (!deletedId) {
    res.status(404).json({ error: '과제를 찾을 수 없습니다.' })
    return
  }

  res.status(204).end()
})

export default router
