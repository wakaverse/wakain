import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FlaskConical, Radar, ScanLine, FileText, Layers, Heart, ArrowLeftRight, Lightbulb,
  LogOut, ChevronLeft, ChevronRight, Menu,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MenuItem {
  key: string;
  icon: React.ElementType;
  path: string;
  comingSoon?: boolean;
}

const menuItems: MenuItem[] = [
  { key: 'radar', icon: Radar, path: '/app/radar' },
  { key: 'hack', icon: ScanLine, path: '/app/hack' },
  { key: 'script', icon: FileText, path: '/app/script', comingSoon: true },
  { key: 'expand', icon: Layers, path: '/app/expand', comingSoon: true },
  { key: 'library', icon: Heart, path: '/app/library' },
  { key: 'compare', icon: ArrowLeftRight, path: '/app/compare', comingSoon: true },
  { key: 'insight', icon: Lightbulb, path: '/app/insight' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-gray-200/60 z-50
        transition-all duration-200 flex flex-col
        ${collapsed ? 'w-16' : 'w-56'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="h-12 flex items-center px-4 border-b border-gray-200/60 shrink-0">
          <Link to="/app/hack" className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-gray-900 shrink-0" />
            {!collapsed && <span className="font-semibold text-sm text-gray-900">WakaLab</span>}
          </Link>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {menuItems.map(({ key, icon: Icon, path, comingSoon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={key}
                to={comingSoon ? '#' : path}
                onClick={(e) => {
                  if (comingSoon) e.preventDefault();
                  setMobileOpen(false);
                }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-gray-900 text-white' : comingSoon ? 'text-gray-300 cursor-default' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.5} />
                {!collapsed && (
                  <span className="flex-1 truncate">{t(`menu.${key}`)}</span>
                )}
                {!collapsed && comingSoon && (
                  <span className="text-[9px] tracking-wider uppercase text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded-full">Soon</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-200/60 p-2 space-y-1 shrink-0">
          {!collapsed && user && (
            <div className="px-3 py-2 text-xs text-gray-400 truncate">
              {user.email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            {!collapsed && <span>{t('menu.logout')}</span>}
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

      {/* Main area */}
      <div className={`flex-1 transition-all duration-200 ${collapsed ? 'lg:ml-16' : 'lg:ml-56'}`}>
        {/* Top bar (mobile) */}
        <header className="h-12 flex items-center px-4 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-30 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="ml-3 font-semibold text-sm text-gray-900">WakaLab</span>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
