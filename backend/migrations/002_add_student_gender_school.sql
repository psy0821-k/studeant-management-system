-- 학생 성별(필수), 학교명(선택) 추가
ALTER TABLE students
  ADD COLUMN gender text NOT NULL CHECK (gender IN ('남', '여')),
  ADD COLUMN school text;
