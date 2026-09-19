import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createTestTeacher, createTestStudent, deleteStudent, deleteTestUser } from './helpers.js'
import { pool } from '../src/db.js'

const app = createApp()
const missingId = '00000000-0000-0000-0000-000000000000'

async function deleteGrade(id: string) {
  await pool.query('DELETE FROM grades WHERE id = $1', [id])
}

describe('학교 성적: 정상', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  let student: Awaited<ReturnType<typeof createTestStudent>>
  const createdGradeIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('grades-normal')
    student = await createTestStudent('grades-normal', teacher.id)
  })

  afterEach(async () => {
    for (const id of createdGradeIds.splice(0)) await deleteGrade(id)
    await deleteStudent(student.id)
    await deleteTestUser(teacher.id)
  })

  it('필수값을 정상 입력하면 201과 함께 examType/score가 올바르게 반환된다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '2학기 중간고사',
        examType: '학교시험',
        score: 88,
        examDate: '2026-09-01',
      })

    expect(res.status).toBe(201)
    expect(res.body.examType).toBe('학교시험')
    expect(typeof res.body.score).toBe('number')
    expect(res.body.score).toBe(88)
    createdGradeIds.push(res.body.id)
  })

  it('gradeLevel/rank/rankInGrade를 생략하면 응답에서 해당 필드가 null이다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '2학기 기말고사',
        examType: '학교시험',
        score: 77,
        examDate: '2026-09-02',
      })

    expect(res.status).toBe(201)
    expect(res.body.gradeLevel).toBeNull()
    expect(res.body.rank).toBeNull()
    expect(res.body.rankInGrade).toBeNull()
    createdGradeIds.push(res.body.id)
  })

  it('GET /api/grades?studentId=&examType=학교시험 은 생성한 항목을 examDate 오름차순으로 반환한다', async () => {
    const first = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '1학기 기말고사',
        examType: '학교시험',
        score: 90,
        examDate: '2026-07-10',
      })
    const second = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '2학기 중간고사',
        examType: '학교시험',
        score: 85,
        examDate: '2026-09-10',
      })
    createdGradeIds.push(first.body.id, second.body.id)

    const listRes = await request(app)
      .get(`/api/grades?studentId=${student.id}&examType=학교시험`)
      .set('Authorization', `Bearer ${teacher.token}`)

    expect(listRes.status).toBe(200)
    const ids = listRes.body.map((g: { id: string }) => g.id)
    expect(ids).toContain(first.body.id)
    expect(ids).toContain(second.body.id)

    const examDates = listRes.body.map((g: { examDate: string }) => g.examDate)
    const sorted = [...examDates].sort()
    expect(examDates).toEqual(sorted)
  })

  it('DELETE /api/grades/:id 는 204를 반환하고 이후 목록에서 제거된다', async () => {
    const created = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '삭제될 시험',
        examType: '학교시험',
        score: 70,
        examDate: '2026-09-05',
      })

    const deleteRes = await request(app)
      .delete(`/api/grades/${created.body.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
    expect(deleteRes.status).toBe(204)

    const listRes = await request(app)
      .get(`/api/grades?studentId=${student.id}&examType=학교시험`)
      .set('Authorization', `Bearer ${teacher.token}`)
    const ids = listRes.body.map((g: { id: string }) => g.id)
    expect(ids).not.toContain(created.body.id)
  })
})

describe('학교 성적: 경계값', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  let student: Awaited<ReturnType<typeof createTestStudent>>
  const createdGradeIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('grades-boundary')
    student = await createTestStudent('grades-boundary', teacher.id)
  })

  afterEach(async () => {
    for (const id of createdGradeIds.splice(0)) await deleteGrade(id)
    await deleteStudent(student.id)
    await deleteTestUser(teacher.id)
  })

  it('score = 0 은 201을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, examName: '최저점', examType: '학교시험', score: 0, examDate: '2026-09-01' })
    expect(res.status).toBe(201)
    createdGradeIds.push(res.body.id)
  })

  it('score = 100 은 201을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, examName: '만점', examType: '학교시험', score: 100, examDate: '2026-09-01' })
    expect(res.status).toBe(201)
    createdGradeIds.push(res.body.id)
  })

  it('gradeLevel = 1 은 201을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '등급 최소',
        examType: '학교시험',
        score: 95,
        gradeLevel: 1,
        examDate: '2026-09-01',
      })
    expect(res.status).toBe(201)
    createdGradeIds.push(res.body.id)
  })

  it('gradeLevel = 9 는 201을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '등급 최대',
        examType: '학교시험',
        score: 40,
        gradeLevel: 9,
        examDate: '2026-09-01',
      })
    expect(res.status).toBe(201)
    createdGradeIds.push(res.body.id)
  })
})

describe('학교 성적: 예외', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  let student: Awaited<ReturnType<typeof createTestStudent>>

  beforeEach(async () => {
    teacher = await createTestTeacher('grades-invalid')
    student = await createTestStudent('grades-invalid', teacher.id)
  })

  afterEach(async () => {
    await deleteStudent(student.id)
    await deleteTestUser(teacher.id)
  })

  it('score = -1 은 400과 에러 메시지를 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, examName: '음수 점수', examType: '학교시험', score: -1, examDate: '2026-09-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('score = 100.1 은 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, examName: '초과 점수', examType: '학교시험', score: 100.1, examDate: '2026-09-01' })
    expect(res.status).toBe(400)
  })

  it('gradeLevel = 0 은 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '등급 범위 밖',
        examType: '학교시험',
        score: 80,
        gradeLevel: 0,
        examDate: '2026-09-01',
      })
    expect(res.status).toBe(400)
  })

  it('gradeLevel = 10 은 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        studentId: student.id,
        examName: '등급 범위 밖 2',
        examType: '학교시험',
        score: 80,
        gradeLevel: 10,
        examDate: '2026-09-01',
      })
    expect(res.status).toBe(400)
  })

  it("examType = '기타' 는 400을 반환한다", async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, examName: '허용 외 유형', examType: '기타', score: 80, examDate: '2026-09-01' })
    expect(res.status).toBe(400)
  })

  it('studentId/examName/examType/examDate 중 하나라도 누락되면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ examName: '시험명만 있음', examType: '학교시험', score: 80 })
    expect(res.status).toBe(400)
  })

  it('GET /api/grades 는 studentId 쿼리 없이 호출하면 400을 반환한다', async () => {
    const res = await request(app).get('/api/grades').set('Authorization', `Bearer ${teacher.token}`)
    expect(res.status).toBe(400)
  })

  it('DELETE /api/grades/:id 는 존재하지 않는 id면 404와 에러 메시지를 반환한다', async () => {
    const res = await request(app).delete(`/api/grades/${missingId}`).set('Authorization', `Bearer ${teacher.token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })

  it('examName에 SQL 인젝션 문자열을 넣어도 안전하게 저장된다', async () => {
    const maliciousName = "'; DROP TABLE grades; --"
    const res = await request(app)
      .post('/api/grades')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, examName: maliciousName, examType: '학교시험', score: 80, examDate: '2026-09-01' })

    expect(res.status).toBe(201)
    expect(res.body.examName).toBe(maliciousName)
    await deleteGrade(res.body.id)

    // grades 테이블이 실제로 살아있는지 확인 (DROP TABLE이 실행되지 않았음을 증명)
    const listRes = await request(app)
      .get(`/api/grades?studentId=${student.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
    expect(listRes.status).toBe(200)
  })
})

describe('학교 성적: 인증 가드', () => {
  it('토큰 없이 GET /api/grades?studentId=x 는 401을 반환한다', async () => {
    const res = await request(app).get('/api/grades?studentId=x')
    expect(res.status).toBe(401)
  })

  it('토큰 없이 POST /api/grades 는 401을 반환한다', async () => {
    const res = await request(app)
      .post('/api/grades')
      .send({ studentId: 'x', examName: 'x', examType: '학교시험', score: 80, examDate: '2026-09-01' })
    expect(res.status).toBe(401)
  })

  it('토큰 없이 DELETE /api/grades/:id 는 401을 반환한다', async () => {
    const res = await request(app).delete(`/api/grades/${missingId}`)
    expect(res.status).toBe(401)
  })
})
