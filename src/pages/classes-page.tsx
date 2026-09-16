import Button from '../components/ui/button'
import Card from '../components/ui/card'
import { MOCK_CLASSES } from '../mocks/classes'

function ClassesPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-page-title text-gray-900">반 관리</h2>
          <p className="mt-1 text-body-small text-gray-500">
            총 {MOCK_CLASSES.length}개 반을 운영하고 있습니다.
          </p>
        </div>
        <Button variant="primary">반 생성</Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_CLASSES.map((schoolClass) => (
          <Card key={schoolClass.id} className="p-5">
            <h3 className="text-card-title text-gray-900">{schoolClass.name}</h3>
            <p className="mt-1 text-body-small text-gray-500">{schoolClass.subject}</p>
            <dl className="mt-4 space-y-1.5 text-body-small text-gray-600">
              <div className="flex justify-between">
                <dt className="text-gray-400">담당</dt>
                <dd>{schoolClass.teacher}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">일정</dt>
                <dd>{schoolClass.schedule}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">학생 수</dt>
                <dd>{schoolClass.studentCount}명</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ClassesPage
