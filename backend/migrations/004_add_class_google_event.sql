-- 반 일정 하나당 Google Calendar 반복 이벤트 1개를 단방향 동기화
ALTER TABLE class_schedules
  ADD COLUMN google_event_id text;
