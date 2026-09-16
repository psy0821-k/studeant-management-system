-- Phase 0: 기본 테이블 (users, students, classes, grades, homework)
-- 출결/수강료/상담/교재/특이사항은 각 Phase에서 별도 설계

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id      text UNIQUE,
  email          text,
  name           text NOT NULL,
  username       text UNIQUE,
  password_hash  text,
  role           text NOT NULL CHECK (role IN ('원장', '강사')),
  is_approved    boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (google_id IS NOT NULL OR username IS NOT NULL)
);

CREATE TABLE google_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id),
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expires_at      timestamptz NOT NULL,
  scope           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE classes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  subject      text NOT NULL,
  teacher_id   uuid NOT NULL REFERENCES users(id),
  schedule     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  grade          text NOT NULL,
  class_id       uuid REFERENCES classes(id),
  phone          text,
  parent_phone   text,
  status         text NOT NULL CHECK (status IN ('재원', '휴원', '퇴원')),
  enrolled_at    date NOT NULL,
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grades (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id),
  subject      text NOT NULL,
  exam_name    text NOT NULL,
  score        numeric NOT NULL,
  rank         integer,
  exam_date    date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE homework (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes(id),
  title        text NOT NULL,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE homework_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   uuid NOT NULL REFERENCES homework(id),
  student_id    uuid NOT NULL REFERENCES students(id),
  status        text NOT NULL DEFAULT '진행중' CHECK (status IN ('완료', '진행중', '미제출')),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (homework_id, student_id)
);

CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_homework_class_id ON homework(class_id);
CREATE INDEX idx_homework_submissions_homework_id ON homework_submissions(homework_id);
CREATE INDEX idx_homework_submissions_student_id ON homework_submissions(student_id);
