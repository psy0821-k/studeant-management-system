export type UserRole = '원장' | '강사'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
}
