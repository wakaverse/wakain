import { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  BarChart3, Settings, Users, LogOut, ChevronLeft, ChevronRight, Menu, FlaskConical,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdmin } from '../../lib/admin';

interface AdminMenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const menuItems: AdminMenuItem[] = [
  { key: 'dashboard', label: '대시보드', icon: BarChart3, path: '/ctrl-8k3x7' },
  { key: 'pipeline', label: '파이프라인', icon: Settings, path: '/ctrl-8k3x7/pipeline' },
  { key: 'users', label: '사용자', icon: Users, path: '/ctrl-8k3x7/users' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin(user.id)) {
    return <Navigate to="/app/analyze" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-gray-200/60 z-50
        transition-all duration-200 flex flex-col
        ${collapsed ? 'w-16' : 'w-56'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="h-12 flex items-center px-4 border-b border-gray-200/60 shrink-0">
          <Link to="/ctrl-8k3x7" className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-gray-900 shrink-0" />
            {!collapsed && <span className="font-semibold text-sm text-gray-900">WakaLab Admin</span>}
          </Link>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {menuItems.map(({ key, label, icon: Icon, path }) => {
            const active = location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path));
            const isExactDashboard = key === 'dashboard' && location.pathname === '/ctrl-8k3x7';

            return (
              <Link
                key={key}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active || isExactDashboard ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.5} />
                {!collapsed && <span className="flex-1 truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200/60 p-2 space-y-1 shrink-0">
          <Link
            to="/app/analyze"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {!collapsed && <span>앱으로 돌아가기</span>}
          </Link>
          {!collapsed && user && (
            <div className="px-3 py-2 text-xs text-gray-400 truncate">{user.email}</div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            {!collapsed && <span>로그아웃</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-600 transition-colors w-full"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="text-xs">접기</span>}
          </button>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-200 ${collapsed ? 'lg:ml-16' : 'lg:ml-56'}`}>
        <header className="h-12 flex items-center px-4 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-30 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="ml-3 font-semibold text-sm text-gray-900">WakaLab Admin</span>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
