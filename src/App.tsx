import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Layout, NavSection } from './components/Layout';
import { NotFound } from './components/NotFound';
import { applySeoMetadata } from './lib/seo';

/**
 * Every view is loaded on demand. Previously all 13 staff screens (plus the
 * 1.8k-line admin panel) were parsed on first paint even though a given user
 * only ever visits two or three of them.
 */
const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const StudentsView = lazy(() => import('./components/StudentsView').then((m) => ({ default: m.StudentsView })));
const AttendanceView = lazy(() => import('./components/AttendanceView').then((m) => ({ default: m.AttendanceView })));
const MutalaView = lazy(() => import('./components/MutalaView').then((m) => ({ default: m.MutalaView })));
const TeachersView = lazy(() => import('./components/TeachersView').then((m) => ({ default: m.TeachersView })));
const LessonsView = lazy(() => import('./components/LessonsView').then((m) => ({ default: m.LessonsView })));
const ExamsView = lazy(() => import('./components/ExamsView').then((m) => ({ default: m.ExamsView })));
const ResearchView = lazy(() => import('./components/ResearchView').then((m) => ({ default: m.ResearchView })));
const ReportsView = lazy(() => import('./components/ReportsView').then((m) => ({ default: m.ReportsView })));
const FatwaDashboardView = lazy(() =>
  import('./components/fatwa/FatwaDashboardView').then((m) => ({ default: m.FatwaDashboardView }))
);
const FatwaQuestionsView = lazy(() =>
  import('./components/fatwa/FatwaQuestionsView').then((m) => ({ default: m.FatwaQuestionsView }))
);
const FatwaArchiveView = lazy(() =>
  import('./components/fatwa/FatwaArchiveView').then((m) => ({ default: m.FatwaArchiveView }))
);
const AdminPanelView = lazy(() =>
  import('./components/admin/AdminPanelView').then((m) => ({ default: m.AdminPanelView }))
);

type NavigatePayload = { studentId?: string; teacherId?: string; fatwaId?: string };

const SECTION_PATHS: Record<NavSection, string> = {
  admin_panel: 'admin',
  dashboard: 'dashboard',
  students: 'students',
  attendance: 'attendance',
  mutala: 'mutala',
  teachers: 'teachers',
  lessons: 'lessons',
  exams: 'exams',
  research: 'research',
  reports: 'reports',
  fatwa_dashboard: 'fatwa',
  fatwa_questions: 'fatwa/questions',
  fatwa_archive: 'fatwa/archive',
};

const PATH_SECTIONS: Record<string, NavSection> = Object.fromEntries(
  (Object.keys(SECTION_PATHS) as NavSection[]).map((section) => [SECTION_PATHS[section], section])
);

function sectionFromPath(pathname: string): NavSection | null {
  const rest = pathname.replace(/^\/staff\/?/, '').replace(/\/+$/, '');
  if (!rest) return null;
  return PATH_SECTIONS[rest] ?? null;
}

const ViewLoader: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    <div className="h-16 rounded-lg border border-[#DCE4E0] bg-white animate-pulse" />
    <div className="h-72 rounded-lg border border-[#DCE4E0] bg-white animate-pulse" />
  </div>
);

function StaffPortal() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const section = sectionFromPath(location.pathname);
  const payload = (location.state || null) as NavigatePayload | null;

  useEffect(() => {
    applySeoMetadata({
      title: lang === 'ur' ? 'اسٹاف پورٹل | نافع دارالافتاء' : 'Staff Portal | Naafay Dar-ul-Ifta',
      description: 'Internal Academic and Dar-ul-Ifta Management System for authorized staff.',
      path: '/staff',
      noindex: true,
    });
  }, [lang]);

  if (!user) {
    return (
      <LoginScreen
        onOpenPublicPortal={() => navigate('/')}
        onAdminLoggedIn={() => navigate(`/staff/${SECTION_PATHS.admin_panel}`, { replace: true })}
        onTeacherLoggedIn={() => navigate(`/staff/${SECTION_PATHS.attendance}`, { replace: true })}
        onStudentLoggedIn={() => navigate(`/staff/${SECTION_PATHS.attendance}`, { replace: true })}
      />
    );
  }

  const defaultPath = `/staff/${
    user.role === 'admin'
      ? SECTION_PATHS.admin_panel
      : user.role === 'student'
      ? SECTION_PATHS.attendance
      : SECTION_PATHS.fatwa_dashboard
  }`;

  // `/staff` or `/staff/` with no section: send the user to their landing page.
  if (!section) {
    if (location.pathname.replace(/\/+$/, '') === '/staff') {
      return <Navigate to={defaultPath} replace />;
    }
    return <NotFound onGoHome={() => navigate('/')} onGoBack={() => navigate(-1)} />;
  }

  // Only admins may open the admin panel; everyone else goes to the fatwa board.
  if (section === 'admin_panel' && user.role !== 'admin') {
    return <Navigate to={`/staff/${SECTION_PATHS.fatwa_dashboard}`} replace />;
  }

  // Students are strictly scoped: only attendance, mutala, lessons, and teachers allowed
  if (user.role === 'student' && !['attendance', 'mutala', 'lessons', 'teachers'].includes(section)) {
    return <Navigate to={`/staff/${SECTION_PATHS.attendance}`} replace />;
  }

  const handleNavigate = (next: NavSection, nextPayload?: NavigatePayload) => {
    navigate(`/staff/${SECTION_PATHS[next]}`, { state: nextPayload ?? null });
  };

  return (
    <Layout activeSection={section} onNavigate={handleNavigate} onOpenPublicPortal={() => navigate('/')}>
      <Suspense fallback={<ViewLoader />}>
        {section === 'admin_panel' && <AdminPanelView onNavigate={handleNavigate} />}
        {section === 'fatwa_dashboard' && <FatwaDashboardView onNavigate={handleNavigate} />}
        {section === 'fatwa_questions' && <FatwaQuestionsView initialFatwaId={payload?.fatwaId} />}
        {section === 'fatwa_archive' && <FatwaArchiveView onNavigate={handleNavigate} />}
        {section === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
        {section === 'students' && <StudentsView initialStudentId={payload?.studentId} />}
        {section === 'attendance' && <AttendanceView />}
        {section === 'mutala' && <MutalaView />}
        {section === 'teachers' && <TeachersView initialTeacherId={payload?.teacherId} />}
        {section === 'lessons' && <LessonsView />}
        {section === 'exams' && <ExamsView />}
        {section === 'research' && <ResearchView />}
        {section === 'reports' && <ReportsView />}
      </Suspense>
    </Layout>
  );
}

const PublicPortal = lazy(() =>
  import('./components/public/PublicPortalRoot').then((m) => ({ default: m.PublicPortalRoot }))
);

function RootRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const isStaff = location.pathname === '/staff' || location.pathname.startsWith('/staff/');

  if (isStaff) {
    return <StaffPortal />;
  }

  return (
    <Suspense fallback={<ViewLoader />}>
      <PublicPortal onOpenStaffPortal={() => navigate('/staff')} />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <RootRouter />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
