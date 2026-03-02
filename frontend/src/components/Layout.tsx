import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FlaskConical, Mail, ChevronDown, LogOut } from 'lucide-react';
import { SUPPORTED_LANGS, LANG_META, type Lang } from '../i18n';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

function langPrefix(lang: Lang): string {
  return lang === 'ko' ? '' : `/${lang}`;
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const { user, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const lang = i18n.language as Lang;

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function switchLang(next: Lang) {
    setLangOpen(false);
    i18n.changeLanguage(next);
    const currentPrefix = langPrefix(lang);
    let path = location.pathname;
    if (currentPrefix && path.startsWith(currentPrefix)) {
      path = path.slice(currentPrefix.length) || '/';
    }
    const newPath = langPrefix(next) + (path === '/' ? '' : path);
    navigate(newPath || '/');
  }

  const prefix = langPrefix(lang);

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 flex flex-col">
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <Link to={prefix || '/'} className="flex items-center gap-2 font-semibold text-base tracking-tight">
            <FlaskConical className="w-4 h-4 text-gray-900" />
            <span className="text-gray-900">WakaLab</span>
          </Link>
          <nav className="flex items-center gap-1">
            {/* Language Switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <span>{LANG_META[lang].flag}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[120px] z-50">
                  {SUPPORTED_LANGS.map((l) => (
                    <button
                      key={l}
                      onClick={() => switchLang(l)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        l === lang ? 'text-gray-900 font-medium' : 'text-gray-500'
                      }`}
                    >
                      <span>{LANG_META[l].flag}</span>
                      <span>{LANG_META[l].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              to={`${prefix}/contact`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {t('nav.contact')}
            </Link>

            {user ? (
              <>
                <Link
                  to={`${prefix}/analyze`}
                  className="ml-2 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-full transition-colors"
                >
                  {t('nav.start')}
                </Link>
                <button
                  onClick={signOut}
                  className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm text-gray-400 hover:text-gray-900 transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="ml-2 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-full transition-colors"
              >
                {t('nav.start')}
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-200/60 py-8 text-center text-gray-400 text-xs tracking-wide">
        {t('footer.copyright')}
      </footer>
    </div>
  );
}
