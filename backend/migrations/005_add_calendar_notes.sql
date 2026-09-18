-- 강사가 날짜별로 자유롭게 남기는 메모(학교 시험 일정, 학생 특이사항 등)
-- 수업 일정과 무관한 자유 텍스트 항목이며, 학원 전체 공유(강사별 접근 제한 없음)
CREATE TABLE calendar_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date    date NOT NULL,
  content      text NOT NULL,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_notes_note_date ON calendar_notes(note_date);
