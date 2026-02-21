import { Link, useLocation } from 'react-router-dom';
import { Upload, LayoutDashboard, LogIn, LogOut, FlaskConical } from 'lucide-react';
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
    <div className="min-h-screen bg-[#fafafa] text-gray-900 flex flex-col">
      {/* Apple-style frosted nav */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-base tracking-tight">
            <FlaskConical className="w-4 h-4 text-gray-900" />
            <span className="text-gray-900">WakaLab</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
            <Link
              to="/analyze"
              className="ml-2 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-full transition-colors"
            >
              시작하기
            </Link>
            {!loading && (
              user ? (
                <button
                  onClick={signOut}
                  className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  로그인
                </button>
              )
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-200/60 py-8 text-center text-gray-400 text-xs tracking-wide">
        © 2026 CRABs — Creator's AI Bridge
      </footer>
    </div>
  );
}
