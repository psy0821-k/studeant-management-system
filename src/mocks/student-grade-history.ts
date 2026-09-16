export interface GradeHistoryPoint {
  examName: string
  score: number
}

export const MOCK_GRADE_HISTORY: Record<string, GradeHistoryPoint[]> = {
  '1': [
    { examName: '6월 모의고사', score: 78 },
    { examName: '7월 모의고사', score: 84 },
    { examName: '8월 모의고사', score: 88 },
    { examName: '9월 모의고사', score: 92 },
  ],
  '2': [
    { examName: '6월 모의고사', score: 70 },
    { examName: '7월 모의고사', score: 72 },
    { examName: '8월 모의고사', score: 75 },
    { examName: '9월 모의고사', score: 78 },
  ],
  '3': [
    { examName: '6월 모의고사', score: 74 },
    { examName: '7월 모의고사', score: 70 },
    { examName: '8월 모의고사', score: 68 },
    { examName: '9월 모의고사', score: 65 },
  ],
  '4': [
    { examName: '6월 모의고사', score: 80 },
    { examName: '7월 모의고사', score: 83 },
    { examName: '8월 모의고사', score: 85 },
    { examName: '9월 모의고사', score: 88 },
  ],
  '5': [
    { examName: '6월 모의고사', score: 66 },
    { examName: '7월 모의고사', score: 69 },
    { examName: '8월 모의고사', score: 71 },
    { examName: '9월 모의고사', score: 73 },
  ],
}
