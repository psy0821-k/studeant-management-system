import 'dotenv/config'

const API_BASE = process.env.SEED_API_BASE ?? 'http://localhost:4000/api'

const GRADES = ['초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3']
const SCHOOLS_BY_LEVEL = {
  초: ['A초등학교', 'B초등학교'],
  중: ['A중학교', 'B중학교'],
  고: ['A고등학교', 'B고등학교'],
}
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권']
const GIVEN_NAMES = [
  '민준', '서연', '도윤', '하은', '지호', '서윤', '예준', '지우', '주원', '유나',
  '시우', '수아', '준서', '지민', '건우', '다은', '현우', '나연', '민재', '채원',
  '우진', '소율', '선우', '아린', '연우', '유진', '재윤', '가은', '동현', '서현',
]

function pick(arr, index) {
  return arr[index % arr.length]
}

function schoolLevelOf(grade) {
  return grade[0] // '초' | '중' | '고'
}

function randomPhone() {
  const mid = String(Math.floor(1000 + Math.random() * 9000))
  const last = String(Math.floor(1000 + Math.random() * 9000))
  return `010-${mid}-${last}`
}

function buildStudents() {
  const students = []
  let nameCounter = 0

  for (const grade of GRADES) {
    const level = schoolLevelOf(grade)
    const schools = SCHOOLS_BY_LEVEL[level]

    // 학년당 6명 (10개 학년 x 6명 = 60명), 학년 내 성별 3:3, 학교 A/B 3:3
    for (let i = 0; i < 6; i++) {
      const surname = pick(SURNAMES, nameCounter)
      const given = pick(GIVEN_NAMES, nameCounter)
      nameCounter += 1

      students.push({
        name: `${surname}${given}`,
        grade,
        gender: i % 2 === 0 ? '남' : '여',
        school: schools[i % schools.length],
        classId: null,
        phone: randomPhone(),
        parentPhone: randomPhone(),
        status: '재원',
        enrolledAt: '2026-03-02',
      })
    }
  }

  return students
}

async function login() {
  const username = process.env.SEED_USERNAME ?? 'admin'
  const password = process.env.SEED_PASSWORD ?? 'test1234'

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    throw new Error(`로그인 실패: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return data.token
}

async function createStudent(token, student) {
  const res = await fetch(`${API_BASE}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(student),
  })
  if (!res.ok) {
    throw new Error(`학생 생성 실패 (${student.name}): ${res.status} ${await res.text()}`)
  }
  return res.json()
}

const token = await login()
const students = buildStudents()

console.log(`총 ${students.length}명 등록 시작...`)

let created = 0
for (const student of students) {
  await createStudent(token, student)
  created += 1
}

console.log(`완료: ${created}명 등록됨`)
