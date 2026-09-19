-- Phase 5: grades 테이블에 학교성적/모의고사 구분 및 등급·전교석차 컬럼 추가
-- 기존 rank 컬럼은 이제 "반 석차"를 의미한다 (컬럼명 변경 없음, 의미만 재정의).

ALTER TABLE grades
  ADD COLUMN exam_type text CHECK (exam_type IN ('학교시험', '모의고사')),
  ADD COLUMN grade_level integer CHECK (grade_level >= 1 AND grade_level <= 9),
  ADD COLUMN rank_in_grade integer;

COMMENT ON COLUMN grades.rank IS '반 석차 (같은 반 내 순위)';
COMMENT ON COLUMN grades.rank_in_grade IS '전교 석차 (학교 전체 순위)';

CREATE INDEX idx_grades_exam_type ON grades(exam_type);
