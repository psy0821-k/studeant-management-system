import { Pool, types } from 'pg'

// PostgreSQL date 타입(OID 1082)을 JS Date로 변환하면 로컬 타임존 자정으로
// 파싱되어 UTC 기준 slice 시 하루가 밀린다. 문자열(YYYY-MM-DD) 그대로 받는다.
types.setTypeParser(1082, (value) => value)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
