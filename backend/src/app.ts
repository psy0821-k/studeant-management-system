import cors from 'cors'
import express from 'express'
import { pool } from './db.js'
import authRouter from './routes/auth.js'
import classesRouter from './routes/classes.js'
import dashboardRouter from './routes/dashboard.js'
import gradesRouter from './routes/grades.js'
import homeworkRouter from './routes/homework.js'
import studentsRouter from './routes/students.js'

export function createApp() {
  const app = express()
  const allowedOrigin = process.env.CORS_ORIGIN
  // CORS_ORIGIN은 단일 origin 문자열만 지원. Vercel 프리뷰 배포처럼 브랜치마다
  // 도메인이 달라지는 환경을 열어주려면 배열/함수 형태로 바꿔야 함(실제 배포 시 검토).
  app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}))
  app.use(express.json())

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/classes', classesRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/grades', gradesRouter)
  app.use('/api/homework', homeworkRouter)
  app.use('/api/students', studentsRouter)

  return app
}
