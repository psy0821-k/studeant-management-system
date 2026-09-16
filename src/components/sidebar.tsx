import { NavLink } from 'react-router-dom'
import logo from '../assets/logo.svg'

interface MenuItem {
  path: string
  label: string
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard', label: '메인보드' },
  { path: '/students', label: '학생 관리' },
  { path: '/classes', label: '반 관리' },
  { path: '/attendance', label: '출결 관리' },
  { path: '/grades', label: '성적/과제 관리' },
  { path: '/payments', label: '수강료 관리' },
  { path: '/counseling', label: '상담 관리' },
  { path: '/ai-analysis', label: 'AI 분석' },
]

function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <img src={logo} alt="" className="h-8 w-8" />
        <h1 className="text-card-title text-gray-900">학생 관리 시스템</h1>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {MENU_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-body-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
