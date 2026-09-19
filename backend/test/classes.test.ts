import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createTestTeacher, deleteClass, deleteTestUser } from './helpers.js'

const app = createApp()

describe('반 생성/조회: 입력 검증', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const createdClassIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('classes-validation')
  })

  afterEach(async () => {
    for (const id of createdClassIds.splice(0)) await deleteClass(id)
    await deleteTestUser(teacher.id)
  })

  it('이름 또는 과목이 없으면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: '', subject: '수학' })
    expect(res.status).toBe(400)
  })

  it('요일 범위(0~6)를 벗어나면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: '반', subject: '수학', schedules: [{ dayOfWeek: 7, startTime: '16:00', endTime: '18:00' }] })
    expect(res.status).toBe(400)
  })

  it('종료 시간이 시작 시간보다 빠르면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: '반', subject: '수학', schedules: [{ dayOfWeek: 1, startTime: '18:00', endTime: '16:00' }] })
    expect(res.status).toBe(400)
  })

  it('형식이 잘못된 시간 문자열은 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: '반', subject: '수학', schedules: [{ dayOfWeek: 1, startTime: '25:99', endTime: '18:00' }] })
    expect(res.status).toBe(400)
  })

  it('SQL 인젝션을 시도하는 문자열도 일반 텍스트로 안전하게 저장된다', async () => {
    const maliciousName = "'; DROP TABLE classes; --"
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: maliciousName, subject: '수학' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe(maliciousName)
    createdClassIds.push(res.body.id)

    // classes 테이블이 실제로 살아있는지 확인 (DROP TABLE이 실행되지 않았음을 증명)
    const listRes = await request(app).get('/api/classes').set('Authorization', `Bearer ${teacher.token}`)
    expect(listRes.status).toBe(200)
  })

  it('정상 입력은 201과 함께 생성된 반을 반환한다', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        name: '테스트반',
        subject: '수학',
        schedules: [{ dayOfWeek: 1, startTime: '16:00', endTime: '18:00' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.schedules).toHaveLength(1)
    createdClassIds.push(res.body.id)
  })
})

describe('반 조회/수정/삭제: 존재하지 않는 리소스', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>

  beforeEach(async () => {
    teacher = await createTestTeacher('classes-notfound')
  })

  afterEach(async () => {
    await deleteTestUser(teacher.id)
  })

  const missingId = '00000000-0000-0000-0000-000000000000'

  it('존재하지 않는 반 조회는 404를 반환한다', async () => {
    const res = await request(app).get(`/api/classes/${missingId}`).set('Authorization', `Bearer ${teacher.token}`)
    expect(res.status).toBe(404)
  })

  it('존재하지 않는 반 수정은 404를 반환한다', async () => {
    const res = await request(app)
      .put(`/api/classes/${missingId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ name: '반', subject: '수학' })
    expect(res.status).toBe(404)
  })

  it('존재하지 않는 반 삭제는 404를 반환한다', async () => {
    const res = await request(app).delete(`/api/classes/${missingId}`).set('Authorization', `Bearer ${teacher.token}`)
    expect(res.status).toBe(404)
  })
})

describe('반 접근 범위: 학원 전체 공유(강사별 접근 제한 없음)', () => {
  let owner: Awaited<ReturnType<typeof createTestTeacher>>
  let otherTeacher: Awaited<ReturnType<typeof createTestTeacher>>
  let classId: string

  beforeEach(async () => {
    owner = await createTestTeacher('classes-owner')
    otherTeacher = await createTestTeacher('classes-other')

    const created = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: '원장 반', subject: '수학' })
    classId = created.body.id
  })

  afterEach(async () => {
    await deleteClass(classId)
    await deleteTestUser(owner.id)
    await deleteTestUser(otherTeacher.id)
  })

  it('다른 강사도 조회할 수 있다(학원 전체 공유가 의도된 설계)', async () => {
    const res = await request(app)
      .get(`/api/classes/${classId}`)
      .set('Authorization', `Bearer ${otherTeacher.token}`)
    expect(res.status).toBe(200)
  })

  it('다른 강사도 수정할 수 있다(강사별 접근 제한 없음이 의도된 설계)', async () => {
    const res = await request(app)
      .put(`/api/classes/${classId}`)
      .set('Authorization', `Bearer ${otherTeacher.token}`)
      .send({ name: '다른 강사가 수정함', subject: '수학' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('다른 강사가 수정함')
  })
})
