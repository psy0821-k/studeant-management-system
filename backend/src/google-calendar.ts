import { google } from 'googleapis'
import { pool } from './db.js'

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

interface CredentialRow {
  access_token: string
  refresh_token: string
  expires_at: string
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  )
}

export function buildGoogleAuthUrl(userId: string) {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GOOGLE_CALENDAR_SCOPE],
    state: userId,
  })
}

export async function exchangeCodeAndSave(userId: string, code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Google로부터 필요한 토큰을 받지 못했습니다. 다시 연동해주세요.')
  }

  await pool.query(
    `INSERT INTO google_credentials (user_id, access_token, refresh_token, expires_at, scope)
     VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5)
     ON CONFLICT (user_id) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           expires_at = EXCLUDED.expires_at,
           scope = EXCLUDED.scope,
           updated_at = now()`,
    [userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date, GOOGLE_CALENDAR_SCOPE],
  )
}

export async function hasGoogleCalendarConnected(userId: string): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM google_credentials WHERE user_id = $1', [userId])
  return (result.rowCount ?? 0) > 0
}

async function getCalendarClientForUser(userId: string) {
  const result = await pool.query<CredentialRow>(
    'SELECT access_token, refresh_token, expires_at FROM google_credentials WHERE user_id = $1',
    [userId],
  )
  const credential = result.rows[0]
  if (!credential) return null

  const client = createOAuthClient()
  client.setCredentials({
    access_token: credential.access_token,
    refresh_token: credential.refresh_token,
    expiry_date: new Date(credential.expires_at).getTime(),
  })

  client.on('tokens', async (tokens) => {
    if (!tokens.access_token || !tokens.expiry_date) return
    await pool.query(
      `UPDATE google_credentials
       SET access_token = $1, expires_at = to_timestamp($2 / 1000.0), updated_at = now()
       WHERE user_id = $3`,
      [tokens.access_token, tokens.expiry_date, userId],
    )
  })

  return google.calendar({ version: 'v3', auth: client })
}

const RRULE_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

interface SyncSchedule {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  googleEventId: string | null
}

function nextDateForWeekday(dayOfWeek: number): string {
  const now = new Date()
  const diff = (dayOfWeek - now.getDay() + 7) % 7
  const target = new Date(now)
  target.setDate(now.getDate() + diff)
  return target.toISOString().slice(0, 10)
}

function buildEventBody(className: string, schedule: SyncSchedule) {
  const date = nextDateForWeekday(schedule.dayOfWeek)
  return {
    summary: className,
    start: { dateTime: `${date}T${schedule.startTime}:00`, timeZone: 'Asia/Seoul' },
    end: { dateTime: `${date}T${schedule.endTime}:00`, timeZone: 'Asia/Seoul' },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${RRULE_DAY[schedule.dayOfWeek]}`],
  }
}

/**
 * 반 일정을 담당 강사의 Google Calendar에 단방향(앱 -> Calendar)으로 반영한다.
 * 강사가 캘린더를 연동하지 않았다면 조용히 건너뛴다(핵심 기능이 캘린더 연동에 종속되지 않도록).
 */
export async function syncClassSchedulesToGoogleCalendar(
  teacherId: string,
  className: string,
  schedules: SyncSchedule[],
) {
  const calendar = await getCalendarClientForUser(teacherId)
  if (!calendar) return

  for (const schedule of schedules) {
    const eventBody = buildEventBody(className, schedule)

    if (schedule.googleEventId) {
      await calendar.events.update({
        calendarId: 'primary',
        eventId: schedule.googleEventId,
        requestBody: eventBody,
      })
      continue
    }

    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    })
    if (created.data.id) {
      await pool.query('UPDATE class_schedules SET google_event_id = $1 WHERE id = $2', [
        created.data.id,
        schedule.id,
      ])
    }
  }
}

export async function deleteGoogleCalendarEvents(teacherId: string, googleEventIds: string[]) {
  const calendar = await getCalendarClientForUser(teacherId)
  if (!calendar) return

  for (const eventId of googleEventIds) {
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId })
    } catch {
      // 이미 삭제되었거나 접근 불가한 이벤트는 무시한다.
    }
  }
}
