import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { issueToken, requireAuth } from '../auth.js'
import { pool } from '../db.js'

const router = Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

interface UserRow {
  id: string
  name: string
  role: '원장' | '강사'
  password_hash: string | null
  is_approved: boolean
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }

  if (!username || !password) {
    res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' })
    return
  }

  const result = await pool.query<UserRow>(
    'SELECT id, name, role, password_hash, is_approved FROM users WHERE username = $1',
    [username],
  )
  const user = result.rows[0]

  if (!user || !user.password_hash) {
    res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    return
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    return
  }

  const token = issueToken({ id: user.id, name: user.name, role: user.role })
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } })
})

router.post('/google', async (req, res) => {
  const { credential } = req.body as { credential?: string }

  if (!credential) {
    res.status(400).json({ error: 'Google 인증 정보가 없습니다.' })
    return
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()

  if (!payload?.sub || !payload.email || !payload.name) {
    res.status(401).json({ error: 'Google 인증에 실패했습니다.' })
    return
  }

  const existing = await pool.query<UserRow>(
    'SELECT id, name, role, password_hash, is_approved FROM users WHERE google_id = $1',
    [payload.sub],
  )

  let user = existing.rows[0]

  if (!user) {
    const created = await pool.query<UserRow>(
      `INSERT INTO users (google_id, email, name, role)
       VALUES ($1, $2, $3, '강사')
       RETURNING id, name, role, password_hash, is_approved`,
      [payload.sub, payload.email, payload.name],
    )
    user = created.rows[0]
  }

  const token = issueToken({ id: user.id, name: user.name, role: user.role })
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
