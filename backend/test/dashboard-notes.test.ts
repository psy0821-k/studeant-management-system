import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createTestTeacher, deleteTestUser } from './helpers.js'
import { pool } from '../src/db.js'

const app = createApp()

async function deleteNote(id: string) {
  await pool.query('DELETE FROM calendar_notes WHERE id = $1', [id])
}

describe('대시보드 메모: 입력 검증', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const createdNoteIds: string[] = []

  beforeEach(async () => {
    teacher = await createTestTeacher('notes')
  })

  afterEach(async () => {
    for (const id of createdNoteIds.splice(0)) await deleteNote(id)
    await deleteTestUser(teacher.id)
  })

  it('날짜 또는 내용이 없으면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/dashboard/notes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ date: '2026-09-25' })
    expect(res.status).toBe(400)
  })

  it('공백만 있는 내용은 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/dashboard/notes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ date: '2026-09-25', content: '   ' })
    expect(res.status).toBe(400)
  })

  it('start, end 쿼리 없이 조회하면 400을 반환한다', async () => {
    const res = await request(app).get('/api/dashboard/notes').set('Authorization', `Bearer ${teacher.token}`)
    expect(res.status).toBe(400)
  })

  it('스크립트 태그가 포함된 내용도 이스케이프 없이 그대로 저장된다(프론트가 렌더링 시 이스케이프할 책임)', async () => {
    const xssAttempt = '<script>alert(1)</script>'
    const res = await request(app)
      .post('/api/dashboard/notes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ date: '2026-09-25', content: xssAttempt })

    expect(res.status).toBe(201)
    expect(res.body.content).toBe(xssAttempt)
    createdNoteIds.push(res.body.id)
  })

  it('정상 등록 후 조회 시 목록에 포함된다', async () => {
    const created = await request(app)
      .post('/api/dashboard/notes')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ date: '2026-09-25', content: 'A중 중간고사' })
    expect(created.status).toBe(201)
    createdNoteIds.push(created.body.id)

    const listRes = await request(app)
      .get('/api/dashboard/notes?start=2026-09-01&end=2026-10-01')
      .set('Authorization', `Bearer ${teacher.token}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.some((note: { id: string }) => note.id === created.body.id)).toBe(true)
  })
})

describe('대시보드 메모: 존재하지 않는 리소스', () => {
  let teacher: Awaited<ReturnType<typeof createTestTeacher>>
  const missingId = '00000000-0000-0000-0000-000000000000'

  beforeEach(async () => {
    teacher = await createTestTeacher('notes-notfound')
  })

  afterEach(async () => {
    await deleteTestUser(teacher.id)
  })

  it('존재하지 않는 메모 수정은 404를 반환한다', async () => {
    const res = await request(app)
      .put(`/api/dashboard/notes/${missingId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ content: '수정' })
    expect(res.status).toBe(404)
  })

  it('존재하지 않는 메모 삭제는 404를 반환한다', async () => {
    const res = await request(app)
      .delete(`/api/dashboard/notes/${missingId}`)
      .set('Authorization', `Bearer ${teacher.token}`)
    expect(res.status).toBe(404)
  })
})

describe('대시보드 메모: 학원 전체 공유', () => {
  let owner: Awaited<ReturnType<typeof createTestTeacher>>
  let otherTeacher: Awaited<ReturnType<typeof createTestTeacher>>
  let noteId: string

  beforeEach(async () => {
    owner = await createTestTeacher('notes-owner')
    otherTeacher = await createTestTeacher('notes-other')

    const created = await request(app)
      .post('/api/dashboard/notes')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: '2026-09-25', content: '원장이 등록한 메모' })
    noteId = created.body.id
  })

  afterEach(async () => {
    await deleteNote(noteId)
    await deleteTestUser(owner.id)
    await deleteTestUser(otherTeacher.id)
  })

  it('다른 강사가 등록한 메모도 수정할 수 있다(의도된 공유 설계)', async () => {
    const res = await request(app)
      .put(`/api/dashboard/notes/${noteId}`)
      .set('Authorization', `Bearer ${otherTeacher.token}`)
      .send({ content: '다른 강사가 수정함' })
    expect(res.status).toBe(200)
  })
})
