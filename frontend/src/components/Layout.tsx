import { Link, useLocation } from 'react-router-dom';
import { BarChart2, Upload, LayoutDashboard, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const navLinks = [
    { to: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { to: '/analyze', label: '영상 분석', icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            <span className="text-gray-900">WakaIn</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <Link
              to="/analyze"
              className="ml-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              무료로 분석해보기
            </Link>
            {!loading && (
              user ? (
                <button
                  onClick={signOut}
                  className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Google 로그인
                </button>
              )
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-100 py-6 text-center text-gray-400 text-sm">
        © 2026 CRABs Inc.
      </footer>
    </div>
  );
}
