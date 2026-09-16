import Card from '../components/ui/card'

function AiAnalysisPage() {
  return (
    <div>
      <h2 className="text-page-title text-gray-900">AI 분석</h2>
      <p className="mt-1 text-body-small text-gray-500">
        성적 추이·취약 과목 분석과 학생별 맞춤 리포트를 제공합니다.
      </p>

      <Card className="mt-6 flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-card-title text-gray-700">아직 분석할 데이터가 충분하지 않습니다.</p>
        <p className="text-body-small text-gray-400">
          성적 데이터가 쌓이면 이곳에서 AI 분석 리포트를 확인할 수 있습니다.
        </p>
      </Card>
    </div>
  )
}

export default AiAnalysisPage
