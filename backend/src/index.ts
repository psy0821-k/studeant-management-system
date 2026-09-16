import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { pool } from './db.js'

const app = express()
const allowedOrigin = process.env.CORS_ORIGIN
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}))
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok' })
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
