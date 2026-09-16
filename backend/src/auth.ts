import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'

export interface AuthUser {
  id: string
  name: string
  role: '원장' | '강사'
}

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.')
  }
  return secret
})()

export function issueToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' })
    return
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser
    next()
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' })
  }
}
