import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import {
  createTestTeacher,
  createTestStudent,
  createTestClass,
  deleteStudent,
  deleteClass,
  deleteTestUser,
} from './helpers.js'
import { pool } from '../src/db.js'

const app = createApp()
const missingId = '00000000-0000-0000-0000-000000000000'

async function deleteHomework(id: string) {
  await pool.query('DELETE FROM homework_submissions WHERE homework_id = $1', [id])
  await pool.query('DELETE FROM homework WHERE id = $1', [id])
}

async function countSubmissions(homeworkId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*) FROM homework_submissions WHERE homework_id = $1',
    [homeworkId],
  )
  return Number(result.rows[0].count)
}

describe('과제 관리: 정상', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const createdHomeworkIds: string[] = []
  const createdClassIds: string[] = []
  const createdStudentIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('homework-normal')
  })

  afterEach(async () => {
    for (const id of createdHomeworkIds.splice(0)) await deleteHomework(id)
    for (const id of createdStudentIds.splice(0)) await deleteStudent(id)
    for (const id of createdClassIds.splice(0)) await deleteClass(id)
    await deleteTestUser(teacher.id)
  })

  it('classId만으로 POST하면 201과 함께 반 소속 학생 전원 수만큼 submissions가 생성된다', async () => {
    const schoolClass = await createTestClass('homework-normal', teacher.id)
    createdClassIds.push(schoolClass.id)
    const student1 = await createTestStudent('homework-normal-1', teacher.id, schoolClass.id)
    const student2 = await createTestStudent('homework-normal-2', teacher.id, schoolClass.id)
    createdStudentIds.push(student1.id, student2.id)

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ classId: schoolClass.id, title: '숙제 1' })

    expect(res.status).toBe(201)
    createdHomeworkIds.push(res.body.id)

    const listRes = await request(app).get('/api/homework').set('Authorization', `Bearer ${teacher.token}`)
    const created = listRes.body.find((h: { id: string }) => h.id === res.body.id)
    expect(created.submissions).toHaveLength(2)
  })

  it('studentId만으로 POST하면 201과 함께 submissions.length === 1, 해당 studentId와 일치한다', async () => {
    const student = await createTestStudent('homework-normal-student', teacher.id)
    createdStudentIds.push(student.id)

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, title: '개별 숙제' })

    expect(res.status).toBe(201)
    createdHomeworkIds.push(res.body.id)

    const listRes = await request(app).get('/api/homework').set('Authorization', `Bearer ${teacher.token}`)
    const created = listRes.body.find((h: { id: string }) => h.id === res.body.id)
    expect(created.submissions).toHaveLength(1)
    expect(created.submissions[0].studentId).toBe(student.id)
  })

  it('GET /api/homework는 등록된 과제 목록과 각 과제의 submissions를 함께 반환한다', async () => {
    const student = await createTestStudent('homework-normal-list', teacher.id)
    createdStudentIds.push(student.id)
    const created = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, title: '목록 확인용 숙제' })
    createdHomeworkIds.push(created.body.id)

    const res = await request(app).get('/api/homework').set('Authorization', `Bearer ${teacher.token}`)

    expect(res.status).toBe(200)
    const found = res.body.find((h: { id: string }) => h.id === created.body.id)
    expect(found).toBeTruthy()
    expect(found.title).toBe('목록 확인용 숙제')
    expect(Array.isArray(found.submissions)).toBe(true)
  })

  it('DELETE /api/homework/:id는 204를 반환하고 이후 homework_submissions도 조회되지 않는다', async () => {
    const student = await createTestStudent('homework-normal-delete', teacher.id)
    createdStudentIds.push(student.id)
    const created = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, title: '삭제될 숙제' })

    const deleteRes = await request(app)
      .delete(`/api/homework/${created.body.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
    expect(deleteRes.status).toBe(204)

    const remaining = await countSubmissions(created.body.id)
    expect(remaining).toBe(0)
  })
})

describe('과제 관리: 경계값', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const createdHomeworkIds: string[] = []
  const createdClassIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('homework-boundary')
  })

  afterEach(async () => {
    for (const id of createdHomeworkIds.splice(0)) await deleteHomework(id)
    for (const id of createdClassIds.splice(0)) await deleteClass(id)
    await deleteTestUser(teacher.id)
  })

  it('학생이 0명인 빈 반으로 classId POST하면 201과 함께 submissions: []가 반환된다', async () => {
    const emptyClass = await createTestClass('homework-empty', teacher.id)
    createdClassIds.push(emptyClass.id)

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ classId: emptyClass.id, title: '빈 반 숙제' })

    expect(res.status).toBe(201)
    createdHomeworkIds.push(res.body.id)
    expect(res.body.submissions).toEqual([])
  })

  it('title이 공백만 있는 문자열이면 400을 반환한다', async () => {
    const schoolClass = await createTestClass('homework-blank-title', teacher.id)
    createdClassIds.push(schoolClass.id)

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ classId: schoolClass.id, title: '   ' })

    expect(res.status).toBe(400)
  })
})

describe('과제 관리: 예외', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const createdHomeworkIds: string[] = []
  const createdClassIds: string[] = []
  const createdStudentIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('homework-invalid')
  })

  afterEach(async () => {
    for (const id of createdHomeworkIds.splice(0)) await deleteHomework(id)
    for (const id of createdStudentIds.splice(0)) await deleteStudent(id)
    for (const id of createdClassIds.splice(0)) await deleteClass(id)
    await deleteTestUser(teacher.id)
  })

  it('classId와 studentId를 둘 다 보내면 400과 에러 메시지를 반환한다', async () => {
    const schoolClass = await createTestClass('homework-xor-both', teacher.id)
    createdClassIds.push(schoolClass.id)
    const student = await createTestStudent('homework-xor-both', teacher.id)
    createdStudentIds.push(student.id)

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ classId: schoolClass.id, studentId: student.id, title: '둘 다 선택' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('classId와 studentId를 둘 다 생략하면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ title: '아무것도 선택 안 함' })

    expect(res.status).toBe(400)
  })

  it('존재하지 않는 classId로 POST하면 400 또는 404를 반환한다', async () => {
    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ classId: missingId, title: '존재하지 않는 반' })

    expect([400, 404]).toContain(res.status)
  })

  it('존재하지 않는 studentId로 POST하면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: missingId, title: '존재하지 않는 학생' })

    expect(res.status).toBe(400)
  })

  it('DELETE로 존재하지 않는 id를 삭제하면 404와 에러 메시지를 반환한다', async () => {
    const res = await request(app)
      .delete(`/api/homework/${missingId}`)
      .set('Authorization', `Bearer ${teacher.token}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })

  it('title을 생략하고 POST하면 400을 반환한다', async () => {
    const student = await createTestStudent('homework-no-title', teacher.id)
    createdStudentIds.push(student.id)

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id })

    expect(res.status).toBe(400)
  })

  it('title에 SQL 인젝션 문자열을 넣어도 안전하게 저장/조회된다', async () => {
    const student = await createTestStudent('homework-injection', teacher.id)
    createdStudentIds.push(student.id)
    const maliciousTitle = "'; DROP TABLE homework; --"

    const res = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, title: maliciousTitle })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe(maliciousTitle)
    createdHomeworkIds.push(res.body.id)

    const listRes = await request(app).get('/api/homework').set('Authorization', `Bearer ${teacher.token}`)
    expect(listRes.status).toBe(200)
  })
})

describe('과제 관리: 인증 가드', () => {
  it('토큰 없이 GET /api/homework → 401', async () => {
    const res = await request(app).get('/api/homework')
    expect(res.status).toBe(401)
  })

  it('토큰 없이 POST /api/homework → 401', async () => {
    const res = await request(app).post('/api/homework').send({ studentId: 'x', title: '숙제' })
    expect(res.status).toBe(401)
  })

  it('토큰 없이 DELETE /api/homework/:id → 401', async () => {
    const res = await request(app).delete(`/api/homework/${missingId}`)
    expect(res.status).toBe(401)
  })
})

describe('과제 제출 상태 변경: PUT /api/homework/submissions/:id', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const createdHomeworkIds: string[] = []
  const createdStudentIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('homework-submission-status')
  })

  afterEach(async () => {
    for (const id of createdHomeworkIds.splice(0)) await deleteHomework(id)
    for (const id of createdStudentIds.splice(0)) await deleteStudent(id)
    await deleteTestUser(teacher.id)
  })

  async function createHomeworkWithSubmission(): Promise<{ homeworkId: string; submissionId: string }> {
    const student = await createTestStudent('homework-submission-status', teacher.id)
    createdStudentIds.push(student.id)

    const created = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, title: '상태 변경용 숙제' })
    createdHomeworkIds.push(created.body.id)

    return { homeworkId: created.body.id, submissionId: created.body.submissions[0].id }
  }

  it('진행중 상태인 submission에 { status: 완료 }를 PUT하면 200과 함께 status: 완료가 반환된다', async () => {
    const { submissionId } = await createHomeworkWithSubmission()

    await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '진행중' })

    const res = await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '완료' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('완료')
  })

  it('상태 변경 후 GET /api/homework로 다시 조회하면 해당 submission의 status가 갱신되어 있다', async () => {
    const { homeworkId, submissionId } = await createHomeworkWithSubmission()

    await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '완료' })

    const listRes = await request(app).get('/api/homework').set('Authorization', `Bearer ${teacher.token}`)
    const homework = listRes.body.find((h: { id: string }) => h.id === homeworkId)
    const submission = homework.submissions.find((s: { id: string }) => s.id === submissionId)
    expect(submission.status).toBe('완료')
  })

  it('응답 바디에 studentName이 포함된다', async () => {
    const { submissionId } = await createHomeworkWithSubmission()

    const res = await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '진행중' })

    expect(res.body.studentName).toBeTruthy()
  })

  it('순환 규칙을 어기는 값(미제출 → 완료 직행)도 서버는 막지 않고 200으로 그대로 저장한다', async () => {
    const { submissionId } = await createHomeworkWithSubmission()

    const res = await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '완료' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('완료')
  })

  it('{ status: 보류 }처럼 허용되지 않은 문자열을 보내면 400과 에러 메시지를 반환한다', async () => {
    const { submissionId } = await createHomeworkWithSubmission()

    const res = await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '보류' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('status 필드를 생략하고 PUT하면 400을 반환한다', async () => {
    const { submissionId } = await createHomeworkWithSubmission()

    const res = await request(app)
      .put(`/api/homework/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('존재하지 않는 submission id로 PUT하면 404와 에러 메시지를 반환한다', async () => {
    const res = await request(app)
      .put(`/api/homework/submissions/${missingId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: '완료' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })

  it('토큰 없이 PUT /api/homework/submissions/:id → 401', async () => {
    const res = await request(app).put(`/api/homework/submissions/${missingId}`).send({ status: '완료' })
    expect(res.status).toBe(401)
  })
})
