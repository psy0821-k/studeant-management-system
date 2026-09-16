import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { Pool } from 'pg'

const file = process.argv[2]
const sql = readFileSync(file, 'utf-8')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

try {
  await pool.query(sql)
  console.log('Migration applied:', file)
} catch (e) {
  console.error('Migration FAILED:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
