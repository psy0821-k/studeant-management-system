-- 반 반복 일정 (요일 + 시작/종료 시간)
CREATE TABLE class_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=일 ~ 6=토
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_class_schedules_class_id ON class_schedules(class_id);

-- 자유 텍스트 일정 컬럼은 class_schedules로 완전 대체
ALTER TABLE classes DROP COLUMN schedule;
