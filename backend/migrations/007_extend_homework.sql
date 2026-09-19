-- Phase 5: homework 테이블에 개별 학생 단위 등록 지원 추가
-- class_id를 nullable로 변경하고 student_id를 추가해 반 단위/개별 단위를 XOR로 강제한다.

ALTER TABLE homework
  ALTER COLUMN class_id DROP NOT NULL,
  ADD COLUMN student_id uuid REFERENCES students(id);

ALTER TABLE homework
  ADD CONSTRAINT homework_class_or_student_xor
    CHECK ((class_id IS NOT NULL) != (student_id IS NOT NULL));

CREATE INDEX idx_homework_student_id ON homework(student_id);
