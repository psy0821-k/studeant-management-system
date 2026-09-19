import { pool } from '../src/db.js'
import { issueToken } from '../src/auth.js'

interface TestTeacher {
  id: string
  name: string
  token: string
}

/**
 * 테스트 전용 강사 계정을 DB에 만들고 인증 토큰을 발급한다.
 * username을 매 테스트마다 고유하게 생성해 병렬 실행 시 충돌을 피한다.
 */
export async function createTestTeacher(labelPrefix: string): Promise<TestTeacher> {
  const username = `${labelPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const name = `테스트 강사(${labelPrefix})`

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (username, name, role, is_approved)
     VALUES ($1, $2, '강사', true)
     RETURNING id`,
    [username, name],
  )
  const id = result.rows[0].id

  const token = issueToken({ id, name, role: '강사' })
  return { id, name, token }
}

export async function deleteTestUser(userId: string) {
  await pool.query('DELETE FROM users WHERE id = $1', [userId])
}

export async function deleteClass(classId: string) {
  await pool.query('DELETE FROM classes WHERE id = $1', [classId])
}

/**
 * 테스트 전용 학생을 DB에 만든다. grades 등 student_id FK가 필요한 테스트에서 재사용한다.
 */
export async function createTestStudent(labelPrefix: string, createdByUserId: string): Promise<{ id: string }> {
  const name = `테스트 학생(${labelPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)})`

  const result = await pool.query<{ id: string }>(
    `INSERT INTO students (name, grade, gender, status, enrolled_at, created_by)
     VALUES ($1, '중2', '남', '재원', '2026-01-01', $2)
     RETURNING id`,
    [name, createdByUserId],
  )
  return { id: result.rows[0].id }
}

export async function deleteStudent(studentId: string) {
  await pool.query('DELETE FROM students WHERE id = $1', [studentId])
}
