import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const username = 'admin'
const password = 'test1234'
const passwordHash = await bcrypt.hash(password, 10)

await pool.query(
  `INSERT INTO users (username, password_hash, name, role)
   VALUES ($1, $2, '테스트 원장', '원장')
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [username, passwordHash],
)

console.log(`Seeded test user: ${username} / ${password}`)
await pool.end()
