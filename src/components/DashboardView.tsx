import React, { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpRight, Calendar, BookOpen, Clock, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { StatusText } from './StatusText';
import { NavSection } from './Layout';
import { formatActivityAction } from '../lib/activityLabels';

interface DashboardViewProps {
  onNavigate: (section: NavSection, payload?: { studentId?: string; teacherId?: string }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { lang, t, pick } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/dashboard', {}, user);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.role]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-[#DCE4E0] bg-white animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg border border-[#DCE4E0] bg-white animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 text-center">
        <p className="text-sm text-red-700">{error || t('errorLoad')}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{lang === 'ur' ? 'دوبارہ کوشش کریں' : 'Retry'}</span>
        </button>
      </div>
    );
  }

  const m = data.metrics;
  const attendanceRate = m.todayMarked > 0 ? Math.round((m.todayPresent / m.todayMarked) * 100) : 0;

  const kpis = [
    { label: t('totalStudents'), value: m.totalStudents, nav: 'students' as NavSection },
    { label: t('totalTeachers'), value: m.totalTeachers, nav: 'teachers' as NavSection },
    { label: t('activeStudents'), value: m.activeStudents, nav: 'students' as NavSection },
    { label: t('todayAttendance'), value: `${attendanceRate}%`, sub: `${m.todayPresent}/${m.todayMarked}`, nav: 'attendance' as NavSection },
    { label: t('absentStudents'), value: m.todayAbsent, danger: m.todayAbsent > 0, nav: 'attendance' as NavSection },
    { label: t('pendingStudy'), value: m.pendingStudySubmissions, warn: m.pendingStudySubmissions > 0, nav: 'mutala' as NavSection },
    { label: t('pendingReviews'), value: m.pendingTeacherReviews, warn: m.pendingTeacherReviews > 0, nav: 'mutala' as NavSection },
  ];

  return (
    <div className="space-y-6">
      {/* Institutional Welcome Banner */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#5A6D65] tabular-nums">
            <span>{data.today}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{lang === 'ur' ? 'تعلیمی سال ۱۴۴۷-۱۴۴۸ھ' : 'Academic Year 1447-1448 AH'}</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-[#111C18]">
            {lang === 'ur'
              ? `خوش آمدید، ${user?.nameUr || ''}`
              : `Welcome, ${user?.nameEn || ''}`}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B] transition-colors whitespace-nowrap"
          >
            {t('navAttendance')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="rounded-md border border-[#DCE4E0] bg-white px-4 py-2 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7] transition-colors whitespace-nowrap"
          >
            {t('navStudents')}
          </button>
        </div>
      </div>

      {/* 7-Metric Academic KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {kpis.map((k, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onNavigate(k.nav)}
            className="text-start rounded-lg border border-[#DCE4E0] bg-white p-4 hover:border-[#065F46]/50 transition-colors"
          >
            <div className="text-xs text-[#5A6D65]">{k.label}</div>
            <div
              className={`mt-2 text-2xl font-bold tabular-nums ${
                k.danger ? 'text-[#B91C1C]' : k.warn ? 'text-[#B45309]' : 'text-[#064E3B]'
              }`}
            >
              {k.value}
            </div>
            {k.sub && <div className="mt-0.5 text-[11px] text-[#5A6D65] tabular-nums">{k.sub}</div>}
          </button>
        ))}
      </div>

      {/* Three-Session Today Summary */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white">
        <div className="px-5 py-4 border-b border-[#E5ECE8] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#065F46]" />
            <h3 className="text-sm font-semibold text-[#111C18]">{t('sessionSummaryToday')}</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#065F46] hover:underline whitespace-nowrap"
          >
            <span>{t('attMarkTab')}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-3 min-w-[700px] divide-x rtl:divide-x-reverse divide-[#E5ECE8]">
            {data.sessionBreakdown.map((ses: any) => (
              <div key={ses.id} className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[#111C18] whitespace-nowrap">{pick(ses.name_en, ses.name_ur)}</span>
                  <span className="text-xs font-mono-code text-[#5A6D65] tabular-nums whitespace-nowrap">
                    {ses.start_time} - {ses.end_time}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs tabular-nums whitespace-nowrap">
                  <span className="text-[#15803D]">
                    {t('present')}: {ses.present_count || 0}
                  </span>
                  <span className="text-[#B91C1C]">
                    {t('absent')}: {ses.absent_count || 0}
                  </span>
                  <span className="text-[#B45309]">
                    {t('late')}: {ses.late_count || 0}
                  </span>
                  <span className="text-[#475569]">
                    {t('leave')}: {ses.leave_count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-Column Detail Grid: Recent Lessons + Upcoming Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Lessons */}
        <div className="rounded-lg border border-[#DCE4E0] bg-white">
          <div className="px-5 py-4 border-b border-[#E5ECE8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#065F46]" />
              <h3 className="text-sm font-semibold text-[#111C18]">{t('recentLessons')}</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('lessons')}
              className="text-xs font-medium text-[#065F46] hover:underline"
            >
              {t('navLessons')}
            </button>
          </div>
          <div className="divide-y divide-[#EEF2F0]">
            {data.recentLessons.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A6D65]">{t('noData')}</div>
            ) : (
              data.recentLessons.map((l: any) => (
                <div key={l.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm text-[#111C18]">
                      {pick(l.teacher_name, l.teacher_name_ur)}
                      <span className="mx-1.5 text-[#CBD5D1]" aria-hidden="true">·</span>
                      <span className="text-[#064E3B]">{pick(l.book_title_en, l.book_title_ur)}</span>
                    </div>
                    <div className="text-xs text-[#065F46]">
                      <span className="text-[#5A6D65]">{lang === 'ur' ? 'کہاں سے کہاں تک پڑھایا: ' : 'Taught (From — To): '}</span>
                      <span>{l.start_position} — {l.end_position}</span>
                      <span className="mx-1.5 text-[#CBD5D1]" aria-hidden="true">·</span>
                      <span className="text-[#5A6D65]">{pick(l.class_name_en, l.class_name_ur)}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono-code text-[#5A6D65] tabular-nums shrink-0">{l.lesson_date}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Exams */}
        <div className="rounded-lg border border-[#DCE4E0] bg-white">
          <div className="px-5 py-4 border-b border-[#E5ECE8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#065F46]" />
              <h3 className="text-sm font-semibold text-[#111C18]">{t('upcomingExams')}</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('exams')}
              className="text-xs font-medium text-[#065F46] hover:underline"
            >
              {t('navExams')}
            </button>
          </div>
          <div className="divide-y divide-[#EEF2F0]">
            {data.upcomingExams.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A6D65]">{t('noData')}</div>
            ) : (
              data.upcomingExams.map((e: any) => (
                <div key={e.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#111C18]">{pick(e.title_en, e.title_ur)}</div>
                    <div className="mt-0.5 text-xs text-[#5A6D65] tabular-nums">
                      <span>{pick(e.class_name_en, e.class_name_ur)}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>
                        {e.start_date} — {e.end_date}
                      </span>
                    </div>
                  </div>
                  <StatusText status={e.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Absent Today & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-[#DCE4E0] bg-white">
          <div className="px-5 py-4 border-b border-[#E5ECE8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#B91C1C]" />
              <h3 className="text-sm font-semibold text-[#111C18]">{t('absentTodayList')}</h3>
            </div>
          </div>
          <div className="divide-y divide-[#EEF2F0]">
            {data.absentTodayList.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A6D65]">
                {lang === 'ur' ? 'آج کوئی طالب علم غیر حاضر نہیں ہے' : 'No absent students recorded today'}
              </div>
            ) : (
              data.absentTodayList.map((a: any) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => onNavigate('students', { studentId: a.student_id })}
                      className="text-sm font-medium text-[#065F46] hover:underline"
                    >
                      {pick(a.full_name, a.full_name_ur)}
                    </button>
                    <div className="text-xs text-[#5A6D65]">
                      <span className="font-mono-code">{a.student_code}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{pick(a.class_name_en, a.class_name_ur)}</span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#B91C1C]">{pick(a.session_name_en, a.session_name_ur)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#DCE4E0] bg-white">
          <div className="px-5 py-4 border-b border-[#E5ECE8]">
            <h3 className="text-sm font-semibold text-[#111C18]">{t('recentActivities')}</h3>
          </div>
          <div className="divide-y divide-[#EEF2F0]">
            {data.recentActivities.map((act: any) => (
              <div key={act.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-[#111C18]">{formatActivityAction(act.action, lang)}</div>
                  <div className="text-xs text-[#5A6D65]">{act.actor_name}</div>
                </div>
                <span className="text-[11px] font-mono-code text-[#5A6D65] tabular-nums shrink-0">
                  {(act.created_at || '').slice(0, 16)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
