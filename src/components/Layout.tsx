import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  BookOpenCheck,
  GraduationCap,
  BookMarked,
  ClipboardList,
  ScrollText,
  FileSpreadsheet,
  Scale,
  FileQuestion,
  Archive,
  Search,
  Globe,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth, UserRole } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { formatPakistaniMobile } from '../lib/phone';

export type NavSection =
  | 'admin_panel'
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'mutala'
  | 'teachers'
  | 'lessons'
  | 'exams'
  | 'research'
  | 'reports'
  | 'fatwa_dashboard'
  | 'fatwa_questions'
  | 'fatwa_archive';

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection, payload?: { studentId?: string; teacherId?: string; fatwaId?: string }) => void;
  onOpenPublicPortal?: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeSection, onNavigate, onOpenPublicPortal, children }) => {
  const { lang, toggleLang, t, pick } = useLanguage();
  const { user, signInAsRole, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('naafay_sidebar_collapsed');
    return saved !== 'false'; // Default to true (icon-only compact mode)
  });

  const homeSection: NavSection = user?.role === 'admin' ? 'admin_panel' : 'fatwa_dashboard';

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('naafay_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fatwaNav: Array<{ id: NavSection; label: string; icon: React.ReactNode }> = [
    { id: 'fatwa_dashboard', label: t('navFatwaDashboard'), icon: <Scale className="h-4 w-4 shrink-0" /> },
    { id: 'fatwa_questions', label: t('navFatwaQuestions'), icon: <FileQuestion className="h-4 w-4 shrink-0" /> },
    { id: 'fatwa_archive', label: t('navFatwaArchive'), icon: <Archive className="h-4 w-4 shrink-0" /> },
  ];

  const academicNav: Array<{ id: NavSection; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: t('navDashboard'), icon: <LayoutDashboard className="h-4 w-4 shrink-0" /> },
    { id: 'students', label: t('navStudents'), icon: <Users className="h-4 w-4 shrink-0" /> },
    { id: 'attendance', label: t('navAttendance'), icon: <CalendarCheck className="h-4 w-4 shrink-0" /> },
    { id: 'mutala', label: t('navMutala'), icon: <BookOpenCheck className="h-4 w-4 shrink-0" /> },
    { id: 'teachers', label: t('navTeachers'), icon: <GraduationCap className="h-4 w-4 shrink-0" /> },
    { id: 'lessons', label: t('navLessons'), icon: <BookMarked className="h-4 w-4 shrink-0" /> },
    { id: 'exams', label: t('navExams'), icon: <ClipboardList className="h-4 w-4 shrink-0" /> },
    { id: 'research', label: t('navResearch'), icon: <ScrollText className="h-4 w-4 shrink-0" /> },
    { id: 'reports', label: t('navReports'), icon: <FileSpreadsheet className="h-4 w-4 shrink-0" /> },
  ];

  const adminNav: Array<{ id: NavSection; label: string; icon: React.ReactNode }> =
    user?.role === 'admin'
      ? [{ id: 'admin_panel', label: t('navAdminPanel'), icon: <ShieldCheck className="h-4 w-4 shrink-0" /> }]
      : [];

  // Place Master Admin Control at the bottom after Academic/Reports
  const allNav = [...fatwaNav, ...academicNav, ...adminNav];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const [acad, fatwa] = await Promise.all([
          apiFetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }, user),
          apiFetch(`/api/fatwa/dashboard?search=${encodeURIComponent(q)}`, { signal: controller.signal }, user),
        ]);
        if (controller.signal.aborted) return;
        setSearchResults({ ...acad, fatwas: (fatwa.questions || []).slice(0, 5) });
      } catch (err: any) {
        // Aborted requests are expected while the user is still typing.
        if (err?.name !== 'AbortError' && !controller.signal.aborted) setSearchResults(null);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, user]);

  const roleLabels: Record<UserRole, string> = {
    admin: t('roleAdmin'),
    senior_mufti: t('roleSeniorMufti'),
    mufti: t('roleTeacher'),
    office_staff: t('roleStaff'),
    student: t('roleStudent'),
  };

  const activeNav = allNav.find((n) => n.id === activeSection);

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Navy & Emerald Institutional Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 z-40 shrink-0 bg-[#0B2545] text-white flex flex-col transition-all duration-200 lg:static lg:translate-x-0 ${
          sidebarCollapsed ? 'w-[272px] lg:w-[74px]' : 'w-[272px]'
        } ${
          lang === 'ur'
            ? sidebarOpen
              ? 'right-0 translate-x-0'
              : 'right-0 translate-x-full lg:translate-x-0'
            : sidebarOpen
              ? 'left-0 translate-x-0'
              : 'left-0 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3.5'} border-b border-white/10`}>
          <button
            type="button"
            onClick={() => {
              onNavigate(homeSection);
              setSidebarOpen(false);
            }}
            className="flex items-center gap-3 min-w-0 text-start group cursor-pointer"
            title={lang === 'ur' ? 'پہلا صفحہ (ہوم)' : 'Home Page'}
          >
            <img
              src="/assets/aistudio/naafay_logo_8857642c.jpg"
              alt="Naafay Darul Ifta"
              referrerPolicy="no-referrer"
              className="h-10 w-10 shrink-0 rounded-full bg-white object-contain p-0.5 border border-white/30 group-hover:scale-105 transition-transform"
            />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate group-hover:text-[#34D399] transition-colors">{t('brandName')}</div>
                <div className="text-[11px] text-sky-200/90 truncate">{t('brandSub')}</div>
              </div>
            )}
          </button>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="hidden lg:flex p-1.5 text-sky-200 hover:text-white rounded hover:bg-white/10 transition-colors"
                title={lang === 'ur' ? 'سائیڈ بار سمیٹیں' : 'Collapse Sidebar'}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 text-sky-100 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 lg:px-3 py-4 space-y-5">
          {/* Part 2: Dar-ul-Ifta */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 pb-1.5 text-[11px] text-[#34D399] font-medium">
                {t('moduleDarulIfta')}
              </div>
            )}
            <div className="space-y-1">
              {fatwaNav.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                    } rounded-md py-2.5 text-xs transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#057A4B] text-white shadow-sm'
                        : 'text-sky-50/90 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Part 1: Academic */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 pb-1.5 text-[11px] text-sky-300 font-medium">
                {t('moduleAcademic')}
              </div>
            )}
            <div className="space-y-1">
              {academicNav.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                    } rounded-md py-2.5 text-xs transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#057A4B] text-white shadow-sm'
                        : 'text-sky-50/90 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Part 3 / Master Admin Control: MOVED TO BOTTOM NEAR REPORTS */}
          {user?.role === 'admin' && (
            <div className="pt-2 border-t border-white/10">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1.5 text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                  <span>{t('moduleMasterAdmin')}</span>
                </div>
              )}
              <div className="space-y-1">
                {adminNav.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                      } rounded-md py-2.5 text-xs transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#057A4B] text-white shadow-sm ring-1 ring-amber-300/40'
                          : 'text-amber-200/90 hover:bg-white/10 hover:text-amber-100'
                      }`}
                    >
                      {item.icon}
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className={`p-3 border-t border-white/10 bg-[#081C36] space-y-2 ${sidebarCollapsed ? 'text-center' : ''}`}>
          {!sidebarCollapsed && (
            <>
              <div className="text-xs font-medium text-white truncate">{user ? (lang === 'ur' ? user.nameUr : user.nameEn) : ''}</div>
              <div className="text-[11px] text-sky-200/85 truncate">{user ? roleLabels[user.role] : ''}</div>
            </>
          )}
          {onOpenPublicPortal && (
            <button
              type="button"
              onClick={onOpenPublicPortal}
              title={t('viewPublicPortal')}
              className={`w-full flex items-center justify-center gap-2 rounded-md bg-[#0284C7]/25 border border-[#0284C7]/50 py-1.5 text-xs font-medium text-sky-100 hover:bg-[#0284C7]/40 transition-colors whitespace-nowrap ${
                sidebarCollapsed ? 'px-1' : 'px-3'
              }`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {!sidebarCollapsed && <span>{t('viewPublicPortal')}</span>}
            </button>
          )}
          <button
            type="button"
            onClick={signOut}
            title={t('signOut')}
            className={`w-full flex items-center justify-center gap-2 rounded-md border border-white/20 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap ${
              sidebarCollapsed ? 'px-1' : 'px-3'
            }`}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>{t('signOut')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-20 bg-white border-b border-[#D9E2EC] px-3 lg:px-5 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-md border border-[#D9E2EC] p-1.5 text-[#0B2545] hover:bg-[#F4F7FA]"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="hidden lg:inline-flex p-1.5 rounded-md border border-[#D9E2EC] text-[#0B2545] hover:bg-[#F4F7FA] transition-colors shrink-0"
              title={sidebarCollapsed ? (lang === 'ur' ? 'سائیڈ بار کھولیں' : 'Expand Sidebar') : (lang === 'ur' ? 'سائیڈ بار سمیٹیں' : 'Collapse Sidebar')}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4 text-[#057A4B]" /> : <PanelLeftClose className="h-4 w-4 text-[#0B2545]" />}
            </button>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => onNavigate(homeSection)}
                className="font-bold text-[#0B2545] hover:text-[#057A4B] transition-colors cursor-pointer text-start hidden sm:inline whitespace-nowrap"
                title={lang === 'ur' ? 'پہلا صفحہ (ہوم)' : 'Home Page'}
              >
                {t('brandName')}
              </button>
              {activeNav && activeNav.id !== homeSection && (
                <>
                  <span className="text-[#9FB3C8] hidden sm:inline">/</span>
                  <h1 className="font-semibold text-[#057A4B] truncate">{activeNav.label}</h1>
                </>
              )}
            </div>
          </div>

          {/* Global Search across Fatwas, Students, Teachers, Books */}
          <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className={`h-4 w-4 text-[#486581] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-1.5 text-xs text-[#0F1F38] placeholder-[#627D98] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                  lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>

            {searchQuery.trim() && searchResults && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-md border border-[#D9E2EC] bg-white shadow-lg z-50 max-h-96 overflow-y-auto divide-y divide-[#EDF2F7]">
                {searching && <div className="p-3 text-xs text-[#486581]">{t('loading')}</div>}
                {!searching &&
                  (searchResults.fatwas?.length || 0) === 0 &&
                  (searchResults.students?.length || 0) === 0 &&
                  (searchResults.teachers?.length || 0) === 0 && (
                    <div className="p-4 text-xs text-[#486581] text-center">{t('noSearchResults')}</div>
                  )}

                {(searchResults.fatwas?.length || 0) > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[11px] font-semibold text-[#0B2545]">{t('navFatwaQuestions')}</div>
                    {searchResults.fatwas.map((fq: any) => (
                      <button
                        key={fq.id}
                        type="button"
                        onClick={() => {
                          onNavigate('fatwa_questions', { fatwaId: fq.id });
                          setSearchQuery('');
                          setSearchResults(null);
                        }}
                        className="w-full flex items-center justify-between gap-2 rounded px-2.5 py-2 text-start text-xs hover:bg-[#F4F7FA]"
                      >
                        <span className="font-medium text-[#0F1F38]">{pick(fq.subject_title, fq.subject_title_ur)}</span>
                        <span className="font-mono-code text-[#057A4B] shrink-0">{fq.issued_fatwa_number || fq.fatwa_code}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(searchResults.students?.length || 0) > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[11px] font-semibold text-[#486581]">{t('navStudents')}</div>
                    {searchResults.students.map((st: any) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          onNavigate('students', { studentId: st.id });
                          setSearchQuery('');
                          setSearchResults(null);
                        }}
                        className="w-full flex items-center justify-between rounded px-2.5 py-2 text-start text-xs hover:bg-[#F4F7FA]"
                      >
                        <span className="font-medium text-[#0F1F38]">{pick(st.full_name, st.full_name_ur)}</span>
                        <div className="flex items-center gap-2">
                          {st.phone && <span className="font-mono-code text-[11px] text-[#5A6D65]" dir="ltr">{formatPakistaniMobile(st.phone)}</span>}
                          <span className="font-mono-code text-[#0284C7]">{st.student_code}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {(searchResults.teachers?.length || 0) > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[11px] font-semibold text-[#486581]">{t('navTeachers')}</div>
                    {searchResults.teachers.map((tc: any) => (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => {
                          onNavigate('teachers', { teacherId: tc.id });
                          setSearchQuery('');
                          setSearchResults(null);
                        }}
                        className="w-full flex items-center justify-between rounded px-2.5 py-2 text-start text-xs hover:bg-[#F4F7FA]"
                      >
                        <span className="font-medium text-[#0F1F38]">{pick(tc.full_name, tc.full_name_ur)}</span>
                        <div className="flex items-center gap-2">
                          {tc.phone && <span className="font-mono-code text-[11px] text-[#5A6D65]" dir="ltr">{formatPakistaniMobile(tc.phone)}</span>}
                          <span className="font-mono-code text-[#057A4B]">{tc.teacher_code}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1 rounded-md border border-[#D9E2EC] bg-white px-2 py-1 text-[11px] font-medium text-[#0B2545] hover:bg-[#F4F7FA] transition-colors whitespace-nowrap shrink-0"
              title={t('switchLang')}
            >
              <Globe className="h-3 w-3 text-[#057A4B]" />
              <span>{lang === 'ur' ? 'EN' : 'اردو'}</span>
            </button>

            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#103563] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{roleLabels[user.role]}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {roleMenuOpen && (
                  <div className={`absolute mt-1.5 w-60 rounded-md border border-[#D9E2EC] bg-white shadow-lg z-50 py-1 ${lang === 'ur' ? 'left-0' : 'right-0'}`}>
                    {(['admin', 'senior_mufti', 'mufti', 'office_staff', 'student'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          signInAsRole(r);
                          setRoleMenuOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-xs hover:bg-[#F4F7FA] flex items-center justify-between ${
                          user.role === r ? 'font-semibold text-[#057A4B] bg-[#057A4B]/5' : 'text-[#243B53]'
                        }`}
                      >
                        <span>{roleLabels[r]}</span>
                        {user.role === r && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
