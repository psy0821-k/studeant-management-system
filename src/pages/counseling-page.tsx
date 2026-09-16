import Card from '../components/ui/card'
import { MOCK_COUNSELING } from '../mocks/counseling'

function CounselingPage() {
  return (
    <div>
      <h2 className="text-page-title text-gray-900">상담 관리</h2>
      <p className="mt-1 text-body-small text-gray-500">
        학생별 상담 기록과 이력을 확인합니다.
      </p>

      <div className="mt-6 space-y-3">
        {MOCK_COUNSELING.map((record) => (
          <Card key={record.id} className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-card-title text-gray-900">{record.studentName}</h3>
              <span className="text-caption text-gray-400">{record.date}</span>
            </div>
            <p className="mt-1 text-body-small text-primary-700">{record.topic}</p>
            <p className="mt-2 text-body text-gray-600">{record.summary}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default CounselingPage
