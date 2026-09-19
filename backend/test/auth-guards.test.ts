import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

const app = createApp()

describe('인증 가드: 토큰 없이 보호된 API 호출', () => {
  it('GET /api/classes는 401을 반환한다', async () => {
    const res = await request(app).get('/api/classes')
    expect(res.status).toBe(401)
  })

  it('POST /api/classes는 401을 반환한다', async () => {
    const res = await request(app).post('/api/classes').send({ name: 'x', subject: 'y' })
    expect(res.status).toBe(401)
  })

  it('PUT /api/classes/:id는 401을 반환한다', async () => {
    const res = await request(app)
      .put('/api/classes/00000000-0000-0000-0000-000000000000')
      .send({ name: 'x', subject: 'y' })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/classes/:id는 401을 반환한다', async () => {
    const res = await request(app).delete('/api/classes/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(401)
  })

  it('GET /api/dashboard/calendar-events는 401을 반환한다', async () => {
    const res = await request(app).get('/api/dashboard/calendar-events?start=2026-01-01&end=2026-02-01')
    expect(res.status).toBe(401)
  })

  it('GET /api/dashboard/notes는 401을 반환한다', async () => {
    const res = await request(app).get('/api/dashboard/notes?start=2026-01-01&end=2026-02-01')
    expect(res.status).toBe(401)
  })

  it('POST /api/dashboard/notes는 401을 반환한다', async () => {
    const res = await request(app).post('/api/dashboard/notes').send({ date: '2026-01-01', content: 'x' })
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/google-calendar/status는 401을 반환한다', async () => {
    const res = await request(app).get('/api/auth/google-calendar/status')
    expect(res.status).toBe(401)
  })
})

describe('인증 가드: 위조/만료된 토큰', () => {
  it('형식이 이상한 토큰은 401을 반환한다', async () => {
    const res = await request(app).get('/api/classes').set('Authorization', 'Bearer not-a-real-jwt')
    expect(res.status).toBe(401)
  })

  it('Bearer 접두사 없이 보낸 토큰은 인증되지 않는다', async () => {
    const res = await request(app).get('/api/classes').set('Authorization', 'sometoken')
    expect(res.status).toBe(401)
  })
})
