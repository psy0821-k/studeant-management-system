import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout'
import ProtectedRoute from './components/protected-route'
import LoginPage from './pages/login-page'
import DashboardPage from './pages/dashboard-page'
import StudentsPage from './pages/students-page'
import StudentDetailPage from './pages/student-detail-page'
import ClassesPage from './pages/classes-page'
import AttendancePage from './pages/attendance-page'
import GradesPage from './pages/grades-page'
import MockExamsPage from './pages/mock-exams-page'
import PaymentsPage from './pages/payments-page'
import CounselingPage from './pages/counseling-page'
import AiAnalysisPage from './pages/ai-analysis-page'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="grades" element={<GradesPage />} />
          <Route path="mock-exams" element={<MockExamsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="counseling" element={<CounselingPage />} />
          <Route path="ai-analysis" element={<AiAnalysisPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
