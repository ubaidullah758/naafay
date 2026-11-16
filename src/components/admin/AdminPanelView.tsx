import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  Scale,
  Globe,
  Users,
  History,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ExternalLink,
  Megaphone,
  Save,
  BookOpen,
  KeyRound,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { todayLocal } from '../../lib/date';
import { formatPakistaniMobile, matchesPhoneSearch } from '../../lib/phone';
import { NavSection } from '../Layout';
import { ConfirmDialog } from '../ConfirmDialog';
import { ErrorState } from '../ErrorState';
import { StatusText } from '../StatusText';

interface AdminPanelViewProps {
  onNavigate: (section: NavSection, payload?: { studentId?: string; teacherId?: string; fatwaId?: string }) => void;
}

type AdminMainTab = 'overview' | 'part1' | 'part2' | 'part3' | 'security' | 'users' | 'audit';
type Part1SubTab = 'students' | 'teachers' | 'classes' | 'subjects' | 'records';

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onNavigate }) => {
  const { lang, pick } = useLanguage();
  const { user } = useAuth();

  const [tab, setTab] = useState<AdminMainTab>('overview');
  const [part1Sub, setPart1Sub] = useState<Part1SubTab>('students');
  const [part2Sub, setPart2Sub] = useState<'questions' | 'categories'>('questions');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Part 1 Modals
  const [studentModal, setStudentModal] = useState<any | null>(null);
  const [teacherModal, setTeacherModal] = useState<any | null>(null);
  const [classModal, setClassModal] = useState<any | null>(null);
  const [batchModal, setBatchModal] = useState<any | null>(null);
  const [subjectModal, setSubjectModal] = useState<any | null>(null);
  const [bookModal, setBookModal] = useState<any | null>(null);
  const [examModal, setExamModal] = useState<any | null>(null);
  const [lessonModal, setLessonModal] = useState<any | null>(null);

  // Part 2 Modals
  const [fatwaModal, setFatwaModal] = useState<any | null>(null);
  const [catModal, setCatModal] = useState<any | null>(null);

  // Part 3 Forms (Portal settings + announcements)
  const [portalForm, setPortalForm] = useState<any | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnn, setNewAnn] = useState({ title_ur: '', title_en: '', body_ur: '', body_en: '', date: todayLocal() });

  // Users Modal
  const [profileModal, setProfileModal] = useState<any | null>(null);

  // Security & Passwords State
  const [adminPassForm, setAdminPassForm] = useState({ next: '', confirm: '' });
  const [adminPassLoading, setAdminPassLoading] = useState(false);
  const [pinModal, setPinModal] = useState<{
    type: 'student' | 'teacher';
    id: string;
    name: string;
    code: string;
    pin: string;
  } | null>(null);

  const updateStudentStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }, user);
      notify(lang === 'ur' ? 'طالب علم کی حالت تبدیل کر دی گئی' : 'Student status updated');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateTeacherStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/teachers/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }, user);
      notify(lang === 'ur' ? 'استاذ کی حالت تبدیل کر دی گئی' : 'Teacher status updated');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModal) return;
    if (pinModal.pin.length < 4) {
      setError(lang === 'ur' ? 'خفیہ پن کم از کم 4 ہندسوں پر مشتمل ہونا چاہیے' : 'PIN must be at least 4 digits');
      return;
    }
    try {
      await apiFetch(`/api/${pinModal.type}s/${pinModal.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ newPin: pinModal.pin }),
      }, user);
      notify(lang === 'ur' ? `${pinModal.name} کا نیا پن محفوظ ہو گیا!` : 'PIN updated successfully');
      setPinModal(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassForm.next.length < 4) {
      setError(lang === 'ur' ? 'نیا پاس ورڈ کم از کم 4 حروف پر مشتمل ہونا چاہیے' : 'Password must be at least 4 characters');
      return;
    }
    if (adminPassForm.next !== adminPassForm.confirm) {
      setError(lang === 'ur' ? 'پاس ورڈ اور تصدیق مماثل نہیں ہیں' : 'Passwords do not match');
      return;
    }
    setAdminPassLoading(true);
    try {
      await apiFetch('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ newCode: adminPassForm.next }),
      }, user);
      notify(lang === 'ur' ? 'ایڈمن پاس ورڈ / خفیہ کوڈ کامیابی سے تبدیل ہو گیا!' : 'Admin password updated');
      setAdminPassForm({ next: '', confirm: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdminPassLoading(false);
    }
  };

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/overview', {}, user);
      const safeData: any = {
        academicYears: res?.academicYears || [],
        classes: res?.classes || [],
        batches: res?.batches || [],
        subjects: res?.subjects || [],
        books: res?.books || [],
        students: res?.students || [],
        teachers: res?.teachers || [],
        lessons: res?.lessons || [],
        exams: res?.exams || [],
        mutalaLogs: res?.mutalaLogs || [],
        researchAssignments: res?.researchAssignments || [],
        fatwas: res?.fatwas || [],
        fatwaQuestions: res?.fatwaQuestions || res?.fatwas || [],
        fatwaCategories: res?.fatwaCategories || res?.categories || [],
        publicSubmissions: res?.publicSubmissions || [],
        profiles: res?.profiles || [],
        roles: res?.roles || [],
        auditLogs: res?.auditLogs || [],
        portalSettings: res?.portalSettings || {},
        counts: res?.counts || {
          students: (res?.students || []).length,
          teachers: (res?.teachers || []).length,
          classes: (res?.classes || []).length,
          books: (res?.books || []).length,
          fatwaQuestions: (res?.fatwas || []).length,
          publishedFatwas: (res?.fatwas || []).filter((f: any) => f?.publication_status === 'published').length,
          publicSubmissions: (res?.publicSubmissions || []).length,
        },
        ...res,
      };
      safeData.students = safeData.students || [];
      safeData.teachers = safeData.teachers || [];
      safeData.classes = safeData.classes || [];
      safeData.fatwaQuestions = safeData.fatwaQuestions || [];
      safeData.fatwaCategories = safeData.fatwaCategories || [];
      safeData.publicSubmissions = safeData.publicSubmissions || [];
      safeData.profiles = safeData.profiles || [];
      safeData.counts = safeData.counts || {};

      setData(safeData);
      setPortalForm(safeData.portalSettings || {});
      setAnnouncements(Array.isArray(safeData.announcements) ? safeData.announcements : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.role, user?.profileId]);

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center space-y-2">
        <ShieldCheck className="h-8 w-8 text-red-700 mx-auto" />
        <h2 className="text-lg font-bold text-[#0B2545]">
          {lang === 'ur' ? 'صرف ناظمِ دارالافتاء (ایڈمن) کے لیے مخصوص' : 'Nazim Dar-ul-Ifta (Admin) Access Only'}
        </h2>
        <p className="text-sm text-[#486581]">
          {lang === 'ur'
            ? 'براہِ کرم مکمل کنٹرول پینل استعمال کرنے کے لیے ایڈمن اکاؤنٹ سے لاگ ان کریں۔'
            : 'Please switch to or sign in with the Admin account to manage all modules.'}
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
        <div className="h-80 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const c = data?.counts || {};
  const q = search.trim().toLowerCase();

  const requestDelete = (title: string, message: string, fn: () => Promise<void>) => {
    setConfirmDelete({
      title,
      message,
      onConfirm: async () => {
        try {
          await fn();
          setConfirmDelete(null);
          notify(lang === 'ur' ? 'ریکارڈ کامیابی سے حذف ہو گیا' : 'Record deleted successfully');
          await load();
        } catch (err: any) {
          setConfirmDelete(null);
          setError(err.message);
        }
      },
    });
  };

  // Save Handlers
  const saveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (studentModal.id) {
        await apiFetch(`/api/students/${studentModal.id}`, { method: 'PUT', body: JSON.stringify(studentModal) }, user);
      } else {
        await apiFetch('/api/students', { method: 'POST', body: JSON.stringify(studentModal) }, user);
      }
      setStudentModal(null);
      notify(lang === 'ur' ? 'طالب علم کا ریکارڈ محفوظ ہو گیا' : 'Student saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (teacherModal.id) {
        await apiFetch(`/api/teachers/${teacherModal.id}`, { method: 'PUT', body: JSON.stringify(teacherModal) }, user);
      } else {
        await apiFetch('/api/teachers', { method: 'POST', body: JSON.stringify(teacherModal) }, user);
      }
      setTeacherModal(null);
      notify(lang === 'ur' ? 'استاذ کا ریکارڈ محفوظ ہو گیا' : 'Teacher saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (classModal.id) {
        await apiFetch(`/api/admin/classes/${classModal.id}`, { method: 'PUT', body: JSON.stringify(classModal) }, user);
      } else {
        await apiFetch('/api/admin/classes', { method: 'POST', body: JSON.stringify(classModal) }, user);
      }
      setClassModal(null);
      notify(lang === 'ur' ? 'درجہ محفوظ ہو گیا' : 'Class saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/batches', { method: 'POST', body: JSON.stringify(batchModal) }, user);
      setBatchModal(null);
      notify(lang === 'ur' ? 'بیچ شامل کر دیا گیا' : 'Batch added');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (subjectModal.id) {
        await apiFetch(`/api/admin/subjects/${subjectModal.id}`, { method: 'PUT', body: JSON.stringify(subjectModal) }, user);
      } else {
        await apiFetch('/api/admin/subjects', { method: 'POST', body: JSON.stringify(subjectModal) }, user);
      }
      setSubjectModal(null);
      notify(lang === 'ur' ? 'مضمون محفوظ ہو گیا' : 'Subject saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (bookModal.id) {
        await apiFetch(`/api/admin/books/${bookModal.id}`, { method: 'PUT', body: JSON.stringify(bookModal) }, user);
      } else {
        await apiFetch('/api/admin/books', { method: 'POST', body: JSON.stringify(bookModal) }, user);
      }
      setBookModal(null);
      notify(lang === 'ur' ? 'کتاب محفوظ ہو گئی' : 'Book saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/lessons/${lessonModal.id}`, { method: 'PUT', body: JSON.stringify(lessonModal) }, user);
      setLessonModal(null);
      notify(lang === 'ur' ? 'سبق اپڈیٹ ہو گیا' : 'Lesson updated');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/admin/exams/${examModal.id}`, { method: 'PUT', body: JSON.stringify(examModal) }, user);
      setExamModal(null);
      notify(lang === 'ur' ? 'امتحان اپڈیٹ ہو گیا' : 'Exam updated');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveFatwaQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (fatwaModal.id) {
        await apiFetch(`/api/admin/fatwa/questions/${fatwaModal.id}`, { method: 'PUT', body: JSON.stringify(fatwaModal) }, user);
      } else {
        await apiFetch('/api/fatwa/questions', { method: 'POST', body: JSON.stringify(fatwaModal) }, user);
      }
      setFatwaModal(null);
      notify(lang === 'ur' ? 'استفتاء محفوظ ہو گیا' : 'Fatwa question saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleFatwaPublish = async (fq: any) => {
    try {
      const nextPublish = fq.is_published !== 1;
      await apiFetch(
        `/api/fatwa/questions/${fq.id}/publication`,
        {
          method: 'POST',
          body: JSON.stringify({
            is_published: nextPublish,
            public_title_ur: fq.public_title_ur || fq.subject_title_ur || fq.subject_title,
            public_title_en: fq.public_title_en || fq.subject_title,
            public_question_text: fq.public_question_text || fq.question_text,
            public_answer_text: fq.public_answer_text || '',
          }),
        },
        user
      );
      notify(
        nextPublish
          ? lang === 'ur'
            ? 'فتویٰ پبلک پورٹل پر شائع ہو گیا'
            : 'Fatwa published to Public Portal'
          : lang === 'ur'
            ? 'فتویٰ پبلک پورٹل سے ہٹا دیا گیا'
            : 'Fatwa unpublished from Public Portal'
      );
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (catModal.id) {
        await apiFetch(`/api/fatwa/categories/${catModal.id}`, { method: 'PUT', body: JSON.stringify(catModal) }, user);
      } else {
        await apiFetch('/api/fatwa/categories', { method: 'POST', body: JSON.stringify(catModal) }, user);
      }
      setCatModal(null);
      notify(lang === 'ur' ? 'شعبہ محفوظ ہو گیا' : 'Category saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const savePortalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/portal-settings', { method: 'PUT', body: JSON.stringify(portalForm) }, user);
      notify(lang === 'ur' ? 'پبلک پورٹل کی ترتیبات محفوظ ہو گئیں' : 'Public Portal settings updated');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveAnnouncementsList = async (updatedList: any[]) => {
    try {
      await apiFetch('/api/admin/announcements', { method: 'PUT', body: JSON.stringify({ announcements: updatedList }) }, user);
      setAnnouncements(updatedList);
      notify(lang === 'ur' ? 'اعلانات محفوظ ہو گئے' : 'Announcements updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnn.title_ur.trim() && !newAnn.title_en.trim()) return;
    const item = {
      id: `ann-${Date.now()}`,
      title_ur: newAnn.title_ur.trim() || newAnn.title_en.trim(),
      title_en: newAnn.title_en.trim() || newAnn.title_ur.trim(),
      body_ur: newAnn.body_ur.trim() || newAnn.body_en.trim(),
      body_en: newAnn.body_en.trim() || newAnn.body_ur.trim(),
      date: newAnn.date || todayLocal(),
    };
    const next = [item, ...announcements];
    await saveAnnouncementsList(next);
    setNewAnn({ title_ur: '', title_en: '', body_ur: '', body_en: '', date: todayLocal() });
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (profileModal.id) {
        await apiFetch(`/api/admin/profiles/${profileModal.id}`, { method: 'PUT', body: JSON.stringify(profileModal) }, user);
      } else {
        await apiFetch('/api/admin/profiles', { method: 'POST', body: JSON.stringify(profileModal) }, user);
      }
      setProfileModal(null);
      notify(lang === 'ur' ? 'صارف پروفائل محفوظ ہو گیا' : 'User profile saved');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const mainTabs: Array<{ id: AdminMainTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: lang === 'ur' ? 'مجموعی جائزہ' : 'Overview', icon: <ShieldCheck className="h-4 w-4 shrink-0" /> },
    { id: 'part1', label: lang === 'ur' ? 'حصہ اول: تعلیمی انتظام' : 'Part 1: Academic', icon: <GraduationCap className="h-4 w-4 shrink-0" /> },
    { id: 'part2', label: lang === 'ur' ? 'حصہ دوم: دارالافتاء' : 'Part 2: Dar-ul-Ifta', icon: <Scale className="h-4 w-4 shrink-0" /> },
    { id: 'part3', label: lang === 'ur' ? 'حصہ سوم: پبلک پورٹل' : 'Part 3: Public Portal', icon: <Globe className="h-4 w-4 shrink-0" /> },
    { id: 'security', label: lang === 'ur' ? 'پاس ورڈ و سیکیورٹی' : 'Security & Passwords', icon: <KeyRound className="h-4 w-4 shrink-0" /> },
    { id: 'users', label: lang === 'ur' ? 'صارفین و عہدے' : 'Users & Roles', icon: <Users className="h-4 w-4 shrink-0" /> },
    { id: 'audit', label: lang === 'ur' ? 'آڈٹ لاگ' : 'Audit Logs', icon: <History className="h-4 w-4 shrink-0" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[#057A4B]">
            <span>{lang === 'ur' ? 'مرکزی ایڈمن پینل' : 'Master Admin Panel'}</span>
            <span className="mx-2 text-[#9FB3C8]" aria-hidden="true">·</span>
            <span className="text-[#486581]">{lang === 'ur' ? user.nameUr : user.nameEn}</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-[#0B2545]">
            {lang === 'ur'
              ? 'مکمل نظم و نسق و اختیارات'
              : 'Full Management & System Controls'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ur' ? 'تمام ریکارڈز میں تلاش کریں...' : 'Filter records...'}
            className="rounded-md border border-[#D9E2EC] bg-[#F4F7FA] px-3 py-2 text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none min-w-[210px]"
          />
        </div>
      </div>

      {toast && (
        <div className="rounded-md border border-[#057A4B]/40 bg-[#ECFDF5] px-4 py-3 text-xs font-medium text-[#065F46] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{toast}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="text-[#065F46]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Module Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {mainTabs.map((tItem) => {
          const active = tab === tItem.id;
          return (
            <button
              key={tItem.id}
              type="button"
              onClick={() => setTab(tItem.id)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-[#0B2545] text-white'
                  : 'border border-[#D9E2EC] bg-white text-[#243B53] hover:bg-[#F4F7FA]'
              }`}
            >
              {tItem.icon}
              <span>{tItem.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: lang === 'ur' ? 'طلبہ' : 'Students', val: c.students, go: () => { setTab('part1'); setPart1Sub('students'); } },
              { label: lang === 'ur' ? 'اساتذہ و مفتیان' : 'Teachers', val: c.teachers, go: () => { setTab('part1'); setPart1Sub('teachers'); } },
              { label: lang === 'ur' ? 'درجات و کتب' : 'Classes / Books', val: `${c.classes}/${c.books}`, go: () => { setTab('part1'); setPart1Sub('classes'); } },
              { label: lang === 'ur' ? 'کل استفتاءات' : 'Fatwa Questions', val: c.fatwaQuestions, go: () => { setTab('part2'); setPart2Sub('questions'); } },
              { label: lang === 'ur' ? 'شائع شدہ فتاویٰ' : 'Published Fatawa', val: c.publishedFatwas, go: () => { setTab('part2'); setPart2Sub('questions'); } },
              { label: lang === 'ur' ? 'عوامی درخواستیں' : 'Public Submissions', val: c.publicSubmissions, go: () => setTab('part3') },
            ].map((k, idx) => (
              <button
                key={idx}
                type="button"
                onClick={k.go}
                className="text-start rounded-lg border border-[#D9E2EC] bg-white p-4 hover:border-[#057A4B] transition-colors"
              >
                <div className="text-xs text-[#486581]">{k.label}</div>
                <div className="mt-1 text-2xl font-bold text-[#0B2545] tabular-nums">{k.val}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#0B2545] font-bold text-sm">
                <GraduationCap className="h-4 w-4 text-[#057A4B]" />
                <span>{lang === 'ur' ? 'حصہ اول: تعلیمی انتظام' : 'Part 1: Academic Control'}</span>
              </div>
              <p className="text-xs text-[#486581]">
                {lang === 'ur'
                  ? 'طلبہ، اساتذہ، درجات، بیچز، مضامین، کتب، اسباق، امتحانات، مطالعہ اور تحقیقی مقالات شامل، ترمیم اور حذف کریں۔'
                  : 'Create, update, and delete students, teachers, classes, batches, subjects, books, lessons, exams, mutala, and research.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTab('part1')}
                  className="rounded-md bg-[#057A4B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#04643D]"
                >
                  {lang === 'ur' ? 'تعلیمی پینل کھولیں' : 'Manage Part 1'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#0B2545] font-bold text-sm">
                <Scale className="h-4 w-4 text-[#057A4B]" />
                <span>{lang === 'ur' ? 'حصہ دوم: دارالافتاء ورک فلو' : 'Part 2: Dar-ul-Ifta Control'}</span>
              </div>
              <p className="text-xs text-[#486581]">
                {lang === 'ur'
                  ? 'استفتاءات کی رجسٹریشن، ترمیم، حیثیت کی تبدیلی، اشاعت (پبلش/ان پبلش)، حذف اور فقہی شعبہ جات کا انتظام۔'
                  : 'Manage Fatwa questions, categories, editing, publishing visibility, deletion, and direct workspace access.'}
              </p>
              <button
                type="button"
                onClick={() => setTab('part2')}
                className="rounded-md bg-[#057A4B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#04643D]"
              >
                {lang === 'ur' ? 'دارالافتاء پینل کھولیں' : 'Manage Part 2'}
              </button>
            </div>

            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#0B2545] font-bold text-sm">
                <Globe className="h-4 w-4 text-[#057A4B]" />
                <span>{lang === 'ur' ? 'حصہ سوم: پبلک پورٹل سیٹنگز' : 'Part 3: Public Portal CMS'}</span>
              </div>
              <p className="text-xs text-[#486581]">
                {lang === 'ur'
                  ? 'ادارہ کا تعارف، ناظم کا نام، رابطہ تفصیلات، اہم اعلانات اور عوامی سوالات کا براہِ راست انتظام۔'
                  : 'Edit public portal welcome text, Nazim details, contact numbers, announcements, and review incoming public inquiries.'}
              </p>
              <button
                type="button"
                onClick={() => setTab('part3')}
                className="rounded-md bg-[#057A4B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#04643D]"
              >
                {lang === 'ur' ? 'پبلک پورٹل کنٹرول' : 'Manage Part 3'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PART 1 — ACADEMIC MASTER */}
      {tab === 'part1' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['students', lang === 'ur' ? 'طلبہ' : 'Students'],
                ['teachers', lang === 'ur' ? 'اساتذہ و مفتیان' : 'Teachers'],
                ['classes', lang === 'ur' ? 'درجات و بیچز' : 'Classes & Batches'],
                ['subjects', lang === 'ur' ? 'مضامین و کتب' : 'Subjects & Books'],
                ['records', lang === 'ur' ? 'اسباق، امتحانات و مطالعہ' : 'Lessons, Exams & Mutala'],
              ] as Array<[Part1SubTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPart1Sub(id)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                  part1Sub === id ? 'bg-[#057A4B] text-white' : 'border border-[#D9E2EC] bg-white text-[#243B53]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Part 1 -> Students */}
          {part1Sub === 'students' && (
            <div className="rounded-lg border border-[#D9E2EC] bg-white">
              <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#0B2545]">
                  {lang === 'ur' ? `طلبہ کا ریکارڈ (${data.students.length})` : `Students (${data.students.length})`}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setStudentModal({
                      full_name: '',
                      full_name_ur: '',
                      father_name: '',
                      father_name_ur: '',
                      phone: '',
                      email: '',
                      address_ur: '',
                      class_id: data.classes[0]?.id || '',
                      status: 'active',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'نیا طالب علم' : 'Add Student'}</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F4F7FA] text-[#486581]">
                    <tr>
                      <th className="px-4 py-2.5 text-start">ID</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'نام' : 'Name'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'درجہ' : 'Class'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'موبائل' : 'Phone'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'حالت' : 'Status'}</th>
                      <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'عمل' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF2F7]">
                    {data.students
                      .filter(
                        (s: any) =>
                          !q ||
                          `${s.student_code} ${s.full_name} ${s.full_name_ur}`.toLowerCase().includes(q) ||
                          matchesPhoneSearch(s.phone, q)
                      )
                      .map((s: any) => (
                        <tr key={s.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 font-mono-code font-semibold text-[#0284C7]">{s.student_code}</td>
                          <td className="px-4 py-3 font-medium text-[#0B2545]">{pick(s.full_name, s.full_name_ur)}</td>
                          <td className="px-4 py-3 text-[#486581]">{pick(s.class_name_en, s.class_name_ur)}</td>
                          <td className="px-4 py-3 font-mono-code text-[#486581]" dir="ltr">{formatPakistaniMobile(s.phone)}</td>
                          <td className="px-4 py-3"><StatusText status={s.status} /></td>
                          <td className="px-4 py-3 text-end">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onNavigate('students', { studentId: s.id })}
                                className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#0284C7]"
                                title={lang === 'ur' ? 'مکمل پروفائل' : 'Open Profile'}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentModal({ ...s })}
                                className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#0B2545]"
                                title={lang === 'ur' ? 'ترمیم' : 'Edit'}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestDelete(
                                    lang === 'ur' ? 'طالب علم حذف کریں' : 'Delete Student',
                                    lang === 'ur'
                                      ? `کیا آپ واقعی "${s.full_name_ur || s.full_name}" کا ریکارڈ حذف کرنا چاہتے ہیں؟`
                                      : `Delete student ${s.full_name} (${s.student_code})?`,
                                    () => apiFetch(`/api/students/${s.id}`, { method: 'DELETE' }, user)
                                  )
                                }
                                className="p-1.5 rounded hover:bg-red-50 text-red-700"
                                title={lang === 'ur' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Part 1 -> Teachers */}
          {part1Sub === 'teachers' && (
            <div className="rounded-lg border border-[#D9E2EC] bg-white">
              <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#0B2545]">
                  {lang === 'ur' ? `اساتذہ و مفتیان (${data.teachers.length})` : `Teachers & Muftis (${data.teachers.length})`}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setTeacherModal({
                      full_name: '',
                      full_name_ur: '',
                      qualification: '',
                      qualification_ur: '',
                      specialization: '',
                      phone: '',
                      email: '',
                      status: 'active',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'نیا استاذ / مفتی' : 'Add Teacher'}</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F4F7FA] text-[#486581]">
                    <tr>
                      <th className="px-4 py-2.5 text-start">ID</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'نام' : 'Name'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'اہلیت / تخصص' : 'Qualification'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'فون' : 'Phone'}</th>
                      <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'عمل' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF2F7]">
                    {data.teachers
                      .filter(
                        (tc: any) =>
                          !q ||
                          `${tc.teacher_code} ${tc.full_name} ${tc.full_name_ur}`.toLowerCase().includes(q) ||
                          matchesPhoneSearch(tc.phone, q)
                      )
                      .map((tc: any) => (
                        <tr key={tc.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 font-mono-code font-semibold text-[#057A4B]">{tc.teacher_code}</td>
                          <td className="px-4 py-3 font-medium text-[#0B2545]">{pick(tc.full_name, tc.full_name_ur)}</td>
                          <td className="px-4 py-3 text-[#486581]">{pick(tc.qualification, tc.qualification_ur)}</td>
                          <td className="px-4 py-3 font-mono-code text-[#486581]" dir="ltr">{formatPakistaniMobile(tc.phone)}</td>
                          <td className="px-4 py-3 text-end">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTeacherModal({ ...tc })}
                                className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#0B2545]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestDelete(
                                    lang === 'ur' ? 'استاذ حذف کریں' : 'Delete Teacher',
                                    lang === 'ur'
                                      ? `کیا آپ "${tc.full_name_ur || tc.full_name}" کو حذف کرنا چاہتے ہیں؟`
                                      : `Delete ${tc.full_name}?`,
                                    () => apiFetch(`/api/teachers/${tc.id}`, { method: 'DELETE' }, user)
                                  )
                                }
                                className="p-1.5 rounded hover:bg-red-50 text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Part 1 -> Classes & Batches */}
          {part1Sub === 'classes' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'درجات (Classes)' : 'Classes'}</h3>
                  <button
                    type="button"
                    onClick={() => setClassModal({ code: '', name_en: '', name_ur: '', level_order: data.classes.length + 1 })}
                    className="inline-flex items-center gap-1 rounded-md bg-[#057A4B] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'ur' ? 'نیا درجہ' : 'Add Class'}</span>
                  </button>
                </div>
                <div className="divide-y divide-[#EDF2F7]">
                  {data.classes.map((cls: any) => (
                    <div key={cls.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(cls.name_en, cls.name_ur)}</div>
                        <div className="font-mono-code text-[#486581]">{cls.code}</div>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => setClassModal({ ...cls })} className="p-1.5 rounded hover:bg-[#E2E8F0]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              lang === 'ur' ? 'درجہ حذف کریں' : 'Delete Class',
                              lang === 'ur' ? `درجہ "${cls.name_ur}" حذف کریں؟` : `Delete class ${cls.name_en}?`,
                              () => apiFetch(`/api/admin/classes/${cls.id}`, { method: 'DELETE' }, user)
                            )
                          }
                          className="p-1.5 rounded hover:bg-red-50 text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'بیچز (Batches)' : 'Batches'}</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setBatchModal({
                        class_id: data.classes[0]?.id || '',
                        academic_year_id: data.academicYears[0]?.id || 'ay-1447',
                        name_en: '',
                        name_ur: '',
                        capacity: 30,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-[#057A4B] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'ur' ? 'نیا بیچ' : 'Add Batch'}</span>
                  </button>
                </div>
                <div className="divide-y divide-[#EDF2F7]">
                  {data.batches.map((b: any) => (
                    <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(b.name_en, b.name_ur)}</div>
                        <div className="text-[#486581]">
                          {pick(b.class_name_en, b.class_name_ur)} · {lang === 'ur' ? `گنجائش: ${b.capacity}` : `Cap: ${b.capacity}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          requestDelete(
                            lang === 'ur' ? 'بیچ حذف کریں' : 'Delete Batch',
                            lang === 'ur' ? `بیچ "${b.name_ur}" حذف کریں؟` : `Delete batch ${b.name_en}?`,
                            () => apiFetch(`/api/admin/batches/${b.id}`, { method: 'DELETE' }, user)
                          )
                        }
                        className="p-1.5 rounded hover:bg-red-50 text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Part 1 -> Subjects & Books */}
          {part1Sub === 'subjects' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'مضامین (Subjects)' : 'Subjects'}</h3>
                  <button
                    type="button"
                    onClick={() => setSubjectModal({ code: '', name_en: '', name_ur: '', class_id: data.classes[0]?.id || '' })}
                    className="inline-flex items-center gap-1 rounded-md bg-[#057A4B] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'ur' ? 'نیا مضمون' : 'Add Subject'}</span>
                  </button>
                </div>
                <div className="divide-y divide-[#EDF2F7]">
                  {data.subjects.map((sub: any) => (
                    <div key={sub.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(sub.name_en, sub.name_ur)}</div>
                        <div className="text-[#486581] font-mono-code">{sub.code}</div>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => setSubjectModal({ ...sub })} className="p-1.5 rounded hover:bg-[#E2E8F0]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              lang === 'ur' ? 'مضمون حذف کریں' : 'Delete Subject',
                              lang === 'ur' ? `مضمون "${sub.name_ur}" حذف کریں؟` : `Delete subject ${sub.name_en}?`,
                              () => apiFetch(`/api/admin/subjects/${sub.id}`, { method: 'DELETE' }, user)
                            )
                          }
                          className="p-1.5 rounded hover:bg-red-50 text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'درسی کتب (Books)' : 'Books'}</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setBookModal({
                        subject_id: data.subjects[0]?.id || '',
                        title_en: '',
                        title_ur: '',
                        author: '',
                        total_pages: 300,
                        total_chapters: 15,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-[#057A4B] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'ur' ? 'نئی کتاب' : 'Add Book'}</span>
                  </button>
                </div>
                <div className="divide-y divide-[#EDF2F7] max-h-[460px] overflow-y-auto">
                  {data.books.map((bk: any) => (
                    <div key={bk.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(bk.title_en, bk.title_ur)}</div>
                        <div className="text-[#486581]">
                          {pick(bk.subject_name_en, bk.subject_name_ur)}
                          {bk.author ? ` · ${bk.author}` : ''}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => setBookModal({ ...bk })} className="p-1.5 rounded hover:bg-[#E2E8F0]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              lang === 'ur' ? 'کتاب حذف کریں' : 'Delete Book',
                              lang === 'ur' ? `کتاب "${bk.title_ur}" حذف کریں؟` : `Delete book ${bk.title_en}?`,
                              () => apiFetch(`/api/admin/books/${bk.id}`, { method: 'DELETE' }, user)
                            )
                          }
                          className="p-1.5 rounded hover:bg-red-50 text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Part 1 -> Lessons, Exams, Mutala & Research */}
          {part1Sub === 'records' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Exams */}
              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'امتحانات (Exams)' : 'Examinations'}</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate('exams')}
                    className="text-xs font-medium text-[#057A4B] hover:underline"
                  >
                    {lang === 'ur' ? 'امتحانات صفحہ' : 'Open Exams'}
                  </button>
                </div>
                <div className="divide-y divide-[#EDF2F7]">
                  {data.exams.map((ex: any) => (
                    <div key={ex.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(ex.title_en, ex.title_ur)}</div>
                        <div className="text-[#486581] tabular-nums">
                          {pick(ex.class_name_en, ex.class_name_ur)} · {ex.start_date} — {ex.end_date}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => setExamModal({ ...ex })} className="p-1.5 rounded hover:bg-[#E2E8F0]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              lang === 'ur' ? 'امتحان حذف کریں' : 'Delete Exam',
                              lang === 'ur' ? `"${ex.title_ur}" حذف کریں؟` : `Delete exam ${ex.title_en}?`,
                              () => apiFetch(`/api/admin/exams/${ex.id}`, { method: 'DELETE' }, user)
                            )
                          }
                          className="p-1.5 rounded hover:bg-red-50 text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lessons */}
              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'تدریسی اسباق (Lessons)' : 'Lessons'}</h3>
                </div>
                <div className="divide-y divide-[#EDF2F7] max-h-72 overflow-y-auto">
                  {data.lessons.map((lr: any) => (
                    <div key={lr.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(lr.book_title_en, lr.book_title_ur)}</div>
                        <div className="text-[#486581]">
                          {pick(lr.teacher_name, lr.teacher_name_ur)} · {lr.start_position} — {lr.end_position} ({lr.lesson_date})
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => setLessonModal({ ...lr })} className="p-1.5 rounded hover:bg-[#E2E8F0]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              lang === 'ur' ? 'سبق حذف کریں' : 'Delete Lesson',
                              lang === 'ur' ? 'کیا آپ یہ سبق ریکارڈ حذف کرنا چاہتے ہیں؟' : 'Delete this lesson record?',
                              () => apiFetch(`/api/admin/lessons/${lr.id}`, { method: 'DELETE' }, user)
                            )
                          }
                          className="p-1.5 rounded hover:bg-red-50 text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mutala Logs */}
              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7]">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'روزانہ مطالعہ (Mutala)' : 'Daily Mutala Logs'}</h3>
                </div>
                <div className="divide-y divide-[#EDF2F7] max-h-72 overflow-y-auto">
                  {data.mutalaLogs.map((sl: any) => (
                    <div key={sl.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">
                          {pick(sl.student_name, sl.student_name_ur)} — {pick(sl.book_title_en, sl.book_title_ur)}
                        </div>
                        <div className="text-[#486581]">{sl.chapter} ({sl.study_date})</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          requestDelete(
                            lang === 'ur' ? 'مطالعہ ریکارڈ حذف کریں' : 'Delete Mutala Log',
                            lang === 'ur' ? 'کیا آپ یہ مطالعہ ریکارڈ حذف کرنا چاہتے ہیں؟' : 'Delete this study log?',
                            () => apiFetch(`/api/admin/mutala/${sl.id}`, { method: 'DELETE' }, user)
                          )
                        }
                        className="p-1.5 rounded hover:bg-red-50 text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Research Assignments */}
              <div className="rounded-lg border border-[#D9E2EC] bg-white">
                <div className="px-5 py-4 border-b border-[#EDF2F7]">
                  <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'تحقیقی مقالات (Research)' : 'Research Assignments'}</h3>
                </div>
                <div className="divide-y divide-[#EDF2F7] max-h-72 overflow-y-auto">
                  {data.researchAssignments.map((ra: any) => (
                    <div key={ra.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#0B2545]">{pick(ra.topic_title_en, ra.topic_title_ur)}</div>
                        <div className="text-[#486581]">
                          {pick(ra.student_name, ra.student_name_ur)} · {ra.deadline}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          requestDelete(
                            lang === 'ur' ? 'تحقیقی مقالہ حذف کریں' : 'Delete Research Assignment',
                            lang === 'ur' ? 'کیا آپ یہ تحقیقی مقالہ تفویض حذف کرنا چاہتے ہیں؟' : 'Delete this research assignment?',
                            () => apiFetch(`/api/admin/research-assignments/${ra.id}`, { method: 'DELETE' }, user)
                          )
                        }
                        className="p-1.5 rounded hover:bg-red-50 text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PART 2 — DAR-UL-IFTA MASTER */}
      {tab === 'part2' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPart2Sub('questions')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
                part2Sub === 'questions' ? 'bg-[#057A4B] text-white' : 'border border-[#D9E2EC] bg-white text-[#243B53]'
              }`}
            >
              {lang === 'ur' ? `تمام استفتاءات و فتاویٰ (${data.fatwaQuestions.length})` : `All Questions & Fatawa (${data.fatwaQuestions.length})`}
            </button>
            <button
              type="button"
              onClick={() => setPart2Sub('categories')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
                part2Sub === 'categories' ? 'bg-[#057A4B] text-white' : 'border border-[#D9E2EC] bg-white text-[#243B53]'
              }`}
            >
              {lang === 'ur' ? `فقہی شعبہ جات (${data.fatwaCategories.length})` : `Categories (${data.fatwaCategories.length})`}
            </button>
          </div>

          {part2Sub === 'questions' && (
            <div className="rounded-lg border border-[#D9E2EC] bg-white">
              <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#0B2545]">
                  {lang === 'ur' ? 'استفتاءات و فتاویٰ کا مکمل کنٹرول' : 'Fatwa Questions & Publication Control'}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setFatwaModal({
                      questioner_name: '',
                      questioner_phone: '',
                      questioner_email: '',
                      city: 'Karachi',
                      country: 'Pakistan',
                      category_id: data.fatwaCategories[0]?.id || '',
                      subject_title: '',
                      subject_title_ur: '',
                      question_text: '',
                      is_identity_private: true,
                      source: 'office',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'نیا سوال رجسٹر کریں' : 'Register Question'}</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F4F7FA] text-[#486581]">
                    <tr>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'کوڈ / فتویٰ نمبر' : 'Code'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'موضوع' : 'Subject'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'سائل' : 'Questioner'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'حالت' : 'Workflow'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'اشاعت' : 'Public Portal'}</th>
                      <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'عمل' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF2F7]">
                    {data.fatwaQuestions
                      .filter(
                        (fq: any) =>
                          !q ||
                          `${fq.fatwa_code} ${fq.issued_fatwa_number || ''} ${fq.subject_title} ${fq.subject_title_ur} ${fq.questioner_name}`
                            .toLowerCase()
                            .includes(q)
                      )
                      .map((fq: any) => (
                        <tr key={fq.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3">
                            <div className="font-mono-code font-semibold text-[#0B2545]">{fq.issued_fatwa_number || fq.fatwa_code}</div>
                            {fq.tracking_number && <div className="font-mono-code text-[11px] text-[#0284C7]">{fq.tracking_number}</div>}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#0B2545]">
                            <div>{pick(fq.subject_title, fq.subject_title_ur)}</div>
                            <div className="text-[11px] text-[#486581]">{pick(fq.category_name_en, fq.category_name_ur)}</div>
                          </td>
                          <td className="px-4 py-3 text-[#486581]">{fq.questioner_name}</td>
                          <td className="px-4 py-3"><StatusText status={fq.workflow_status} /></td>
                          <td className="px-4 py-3">
                            {fq.workflow_status === 'issued' ? (
                              <button
                                type="button"
                                onClick={() => toggleFatwaPublish(fq)}
                                className={`rounded px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                                  fq.is_published === 1
                                    ? 'bg-[#ECFDF5] text-[#057A4B] border border-[#057A4B]/30'
                                    : 'bg-[#F4F7FA] text-[#486581] border border-[#D9E2EC]'
                                }`}
                              >
                                {fq.is_published === 1
                                  ? lang === 'ur'
                                    ? 'شائع شدہ (ہٹائیں)'
                                    : 'Published (Unpublish)'
                                  : lang === 'ur'
                                    ? 'شائع کریں'
                                    : 'Publish Now'}
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#627D98]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-end">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onNavigate('fatwa_questions', { fatwaId: fq.id })}
                                className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#0284C7]"
                                title={lang === 'ur' ? 'ورک اسپیس کھولیں' : 'Open Workspace'}
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFatwaModal({ ...fq, is_identity_private: Boolean(fq.is_identity_private) })}
                                className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#0B2545]"
                                title={lang === 'ur' ? 'ترمیم' : 'Edit'}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestDelete(
                                    lang === 'ur' ? 'استفتاء حذف کریں' : 'Delete Fatwa Question',
                                    lang === 'ur'
                                      ? `کیا آپ "${fq.issued_fatwa_number || fq.fatwa_code}" اور اس سے منسلک تمام تحقیق و مسودات حذف کرنا چاہتے ہیں؟`
                                      : `Delete ${fq.issued_fatwa_number || fq.fatwa_code} and all associated drafts/reviews?`,
                                    () => apiFetch(`/api/admin/fatwa/questions/${fq.id}`, { method: 'DELETE' }, user)
                                  )
                                }
                                className="p-1.5 rounded hover:bg-red-50 text-red-700"
                                title={lang === 'ur' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {part2Sub === 'categories' && (
            <div className="rounded-lg border border-[#D9E2EC] bg-white">
              <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'فقہی شعبہ جات' : 'Fatwa Categories'}</h3>
                <button
                  type="button"
                  onClick={() => setCatModal({ code: '', name_en: '', name_ur: '', name_ar: '', is_active: true })}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'نیا شعبہ' : 'Add Category'}</span>
                </button>
              </div>
              <div className="divide-y divide-[#EDF2F7]">
                {data.fatwaCategories.map((cat: any) => (
                  <div key={cat.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-[#0B2545]">
                        {pick(cat.name_en, cat.name_ur)} {cat.name_ar ? `(${cat.name_ar})` : ''}
                      </div>
                      <div className="font-mono-code text-[#486581]">
                        {cat.code} · {cat.is_active ? (lang === 'ur' ? 'فعال' : 'Active') : lang === 'ur' ? 'غیر فعال' : 'Inactive'}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCatModal({ ...cat, is_active: Boolean(cat.is_active) })}
                        className="p-1.5 rounded hover:bg-[#E2E8F0]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          requestDelete(
                            lang === 'ur' ? 'شعبہ حذف کریں' : 'Delete Category',
                            lang === 'ur' ? `شعبہ "${cat.name_ur}" حذف کریں؟` : `Delete category ${cat.name_en}?`,
                            () => apiFetch(`/api/admin/fatwa/categories/${cat.id}`, { method: 'DELETE' }, user)
                          )
                        }
                        className="p-1.5 rounded hover:bg-red-50 text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PART 3 — PUBLIC PORTAL SETTINGS & ANNOUNCEMENTS */}
      {tab === 'part3' && portalForm && (
        <div className="space-y-6">
          <form onSubmit={savePortalSettings} className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[#EDF2F7] pb-3">
              <h3 className="text-sm font-bold text-[#0B2545]">
                {lang === 'ur' ? 'پبلک پورٹل ادارہ جاتی معلومات و سرورق' : 'Public Portal Institutional Settings'}
              </h3>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#04643D]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{lang === 'ur' ? 'ترتیبات محفوظ کریں' : 'Save Settings'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'ادارہ کا نام (اردو)' : 'Institution Name (Urdu)'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={portalForm.institution_name_ur || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, institution_name_ur: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'ادارہ کا نام (انگریزی)' : 'Institution Name (English)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={portalForm.institution_name_en || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, institution_name_en: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'ناظمِ دارالافتاء (اردو)' : 'Nazim Name (Urdu)'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={portalForm.nazim_name_ur || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, nazim_name_ur: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'ناظمِ دارالافتاء (انگریزی)' : 'Nazim Name (English)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={portalForm.nazim_name_en || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, nazim_name_en: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'سرورق عنوان (اردو)' : 'Welcome Title (Urdu)'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={portalForm.welcome_title_ur || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, welcome_title_ur: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'سرورق عنوان (انگریزی)' : 'Welcome Title (English)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={portalForm.welcome_title_en || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, welcome_title_en: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'خوش آمدید پیغام (اردو)' : 'Welcome Body (Urdu)'}
                </label>
                <textarea
                  rows={3}
                  dir="rtl"
                  value={portalForm.welcome_body_ur || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, welcome_body_ur: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'خوش آمدید پیغام (انگریزی)' : 'Welcome Body (English)'}
                </label>
                <textarea
                  rows={3}
                  dir="ltr"
                  value={portalForm.welcome_body_en || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, welcome_body_en: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">{lang === 'ur' ? 'فون نمبر' : 'Contact Phone'}</label>
                <input
                  type="text"
                  dir="ltr"
                  value={portalForm.contact_phone || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, contact_phone: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 font-mono-code"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">{lang === 'ur' ? 'ای میل' : 'Contact Email'}</label>
                <input
                  type="email"
                  dir="ltr"
                  value={portalForm.contact_email || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, contact_email: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 font-mono-code"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">{lang === 'ur' ? 'پتہ (اردو)' : 'Address (Urdu)'}</label>
                <input
                  type="text"
                  dir="rtl"
                  value={portalForm.contact_address_ur || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, contact_address_ur: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">{lang === 'ur' ? 'پتہ (انگریزی)' : 'Address (English)'}</label>
                <input
                  type="text"
                  dir="ltr"
                  value={portalForm.contact_address_en || ''}
                  onChange={(e) => setPortalForm({ ...portalForm, contact_address_en: e.target.value })}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-[#0B2545]">
              <input
                type="checkbox"
                checked={Boolean(portalForm.allow_optional_email)}
                onChange={(e) => setPortalForm({ ...portalForm, allow_optional_email: e.target.checked })}
              />
              <span>
                {lang === 'ur'
                  ? 'عوامی سوال فارم میں ای میل اختیاری (Optional) رکھیں'
                  : 'Keep Email optional on Public Question form'}
              </span>
            </label>
          </form>

          {/* Announcements Manager */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#0B2545]">
              <Megaphone className="h-4 w-4 text-[#057A4B]" />
              <h3 className="text-sm font-bold">{lang === 'ur' ? 'پبلک اعلانات کا انتظام' : 'Manage Public Announcements'}</h3>
            </div>

            <form onSubmit={addAnnouncement} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-4 text-xs">
              <input
                type="text"
                dir="rtl"
                placeholder={lang === 'ur' ? 'اعلان کا عنوان (اردو)' : 'Announcement Title (Urdu)'}
                value={newAnn.title_ur}
                onChange={(e) => setNewAnn({ ...newAnn, title_ur: e.target.value })}
                className="rounded-md border border-[#D9E2EC] bg-white px-3 py-2"
              />
              <input
                type="text"
                dir="ltr"
                placeholder={lang === 'ur' ? 'اعلان کا عنوان (انگریزی)' : 'Announcement Title (English)'}
                value={newAnn.title_en}
                onChange={(e) => setNewAnn({ ...newAnn, title_en: e.target.value })}
                className="rounded-md border border-[#D9E2EC] bg-white px-3 py-2"
              />
              <input
                type="text"
                dir="rtl"
                placeholder={lang === 'ur' ? 'تفصیل (اردو)' : 'Body (Urdu)'}
                value={newAnn.body_ur}
                onChange={(e) => setNewAnn({ ...newAnn, body_ur: e.target.value })}
                className="rounded-md border border-[#D9E2EC] bg-white px-3 py-2"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  placeholder={lang === 'ur' ? 'تفصیل (انگریزی)' : 'Body (English)'}
                  value={newAnn.body_en}
                  onChange={(e) => setNewAnn({ ...newAnn, body_en: e.target.value })}
                  className="flex-1 rounded-md border border-[#D9E2EC] bg-white px-3 py-2"
                />
                <button type="submit" className="rounded-md bg-[#057A4B] px-4 py-2 font-semibold text-white whitespace-nowrap">
                  {lang === 'ur' ? 'شامل کریں' : 'Add'}
                </button>
              </div>
            </form>

            <div className="divide-y divide-[#EDF2F7]">
              {announcements.map((ann) => (
                <div key={ann.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-[#0B2545]">{pick(ann.title_en, ann.title_ur)}</div>
                    <div className="text-[#486581]">{pick(ann.body_en, ann.body_ur)}</div>
                    <div className="font-mono-code text-[11px] text-[#627D98]">{ann.date}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveAnnouncementsList(announcements.filter((a) => a.id !== ann.id))}
                    className="p-1.5 rounded hover:bg-red-50 text-red-700 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Public Submissions Log */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white">
            <div className="px-5 py-4 border-b border-[#EDF2F7]">
              <h3 className="text-sm font-bold text-[#0B2545]">
                {lang === 'ur' ? `پبلک پورٹل سے موصولہ سوالات (${data.publicSubmissions.length})` : `Public Portal Submissions (${data.publicSubmissions.length})`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F4F7FA] text-[#486581]">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'ٹریکنگ نمبر' : 'Tracking #'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'فتویٰ کوڈ' : 'Fatwa Code'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'شعبہ / موضوع' : 'Category / Subject'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'حالت' : 'Status'}</th>
                    <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'عمل' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2F7]">
                  {data.publicSubmissions.map((ps: any) => (
                    <tr key={ps.id}>
                      <td className="px-4 py-3 font-mono-code text-[#0284C7]">{ps.tracking_number}</td>
                      <td className="px-4 py-3 font-mono-code text-[#0B2545]">{ps.fatwa_code}</td>
                      <td className="px-4 py-3">{pick(ps.subject_title, ps.subject_title_ur)}</td>
                      <td className="px-4 py-3"><StatusText status={ps.workflow_status} /></td>
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={() => onNavigate('fatwa_questions', { fatwaId: ps.question_id })}
                          className="text-xs font-medium text-[#057A4B] hover:underline"
                        >
                          {lang === 'ur' ? 'ورک اسپیس' : 'Workspace'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: SECURITY & PASSWORDS */}
      {tab === 'security' && (
        <div className="space-y-6">
          {/* Card 1: Admin Password Change */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 shadow-sm space-y-4">
            <div className="border-b border-[#EDF2F7] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#0B2545] flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#057A4B]" />
                  <span>{lang === 'ur' ? 'ایڈمن پاس ورڈ / خفیہ کوڈ کی تبدیلی' : 'Change Master Admin Password'}</span>
                </h3>
                <p className="text-xs text-[#627D98] mt-0.5">
                  {lang === 'ur'
                    ? 'ایڈمن لاگ ان ہونے کا خفیہ رسائی کوڈ (Access Code) یہاں سے تبدیل کریں۔'
                    : 'Change the master admin access code for system login.'}
                </p>
              </div>
              <span className="text-[11px] font-mono-code px-2.5 py-1 rounded bg-[#0B2545]/10 text-[#0B2545] font-semibold self-start sm:self-auto">
                nazim@naafay.edu.pk
              </span>
            </div>

            <form onSubmit={saveAdminPassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'نیا پاس ورڈ / کوڈ' : 'New Admin Password'}
                </label>
                <div className="relative">
                  <Lock className={`h-3.5 w-3.5 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-2.5' : 'left-2.5'}`} />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    placeholder="کم از کم 4 حروف یا ہندسے"
                    value={adminPassForm.next}
                    onChange={(e) => setAdminPassForm({ ...adminPassForm, next: e.target.value })}
                    className={`w-full rounded border border-[#D9E2EC] bg-[#F8FAFC] py-2 text-xs font-mono-code text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                      lang === 'ur' ? 'pr-8 pl-2.5' : 'pl-8 pr-2.5'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0B2545] mb-1">
                  {lang === 'ur' ? 'نئے پاس ورڈ کی تصدیق' : 'Confirm New Password'}
                </label>
                <div className="relative">
                  <Lock className={`h-3.5 w-3.5 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-2.5' : 'left-2.5'}`} />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    placeholder="دوبارہ درج کریں"
                    value={adminPassForm.confirm}
                    onChange={(e) => setAdminPassForm({ ...adminPassForm, confirm: e.target.value })}
                    className={`w-full rounded border border-[#D9E2EC] bg-[#F8FAFC] py-2 text-xs font-mono-code text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                      lang === 'ur' ? 'pr-8 pl-2.5' : 'pl-8 pr-2.5'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adminPassLoading}
                className="rounded-lg bg-[#057A4B] px-4 py-2 text-xs font-bold text-white hover:bg-[#04633D] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5 h-[34px]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{adminPassLoading ? (lang === 'ur' ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (lang === 'ur' ? 'پاس ورڈ تبدیل کریں' : 'Update Password')}</span>
              </button>
            </form>
          </div>

          {/* Card 2: Student Credentials & Status Manager */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDF2F7]">
              <h3 className="text-sm font-bold text-[#0B2545] flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[#057A4B]" />
                <span>{lang === 'ur' ? `طلبہ کے پاس ورڈز و حالت کا انتظام (${data.students.length})` : `Students Security & Status (${data.students.length})`}</span>
              </h3>
              <p className="text-xs text-[#627D98] mt-0.5">
                {lang === 'ur'
                  ? 'طلبہ کا لاگ ان خفیہ پن ری سیٹ کریں، یا اکاؤنٹ کو فعال، معطل، یا خارج کریں۔'
                  : 'Reset student login PINs and manage account status in real-time.'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F4F7FA] text-[#486581]">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'کوڈ' : 'Code'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'طالب علم کا نام' : 'Name'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'موبائل نمبر' : 'Phone'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'اکاؤنٹ حالت' : 'Account Status'}</th>
                    <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'پاس ورڈ و سیکیورٹی ایکشن' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2F7]">
                  {data.students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono-code font-bold text-[#0284C7]">{s.student_code}</td>
                      <td className="px-4 py-3 font-semibold text-[#0B2545]">{pick(s.full_name, s.full_name_ur)}</td>
                      <td className="px-4 py-3 font-mono-code text-[#486581]" dir="ltr">{formatPakistaniMobile(s.phone)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={s.status || 'active'}
                          onChange={(e) => updateStudentStatus(s.id, e.target.value)}
                          className={`rounded border text-xs px-2 py-1 font-semibold ${
                            s.status === 'active'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : s.status === 'suspended'
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : s.status === 'on_leave'
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-slate-300 bg-slate-50 text-slate-700'
                          }`}
                        >
                          <option value="active">{lang === 'ur' ? 'فعال (Active)' : 'Active'}</option>
                          <option value="on_leave">{lang === 'ur' ? 'رخصت (On Leave)' : 'On Leave'}</option>
                          <option value="suspended">{lang === 'ur' ? 'معطل (Suspended)' : 'Suspended'}</option>
                          <option value="graduated">{lang === 'ur' ? 'فارغ التحصیل (Graduated)' : 'Graduated'}</option>
                          <option value="inactive">{lang === 'ur' ? 'غیر فعال (Inactive)' : 'Inactive'}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPinModal({ type: 'student', id: s.id, name: s.full_name_ur || s.full_name, code: s.student_code, pin: '123456' })}
                            className="inline-flex items-center gap-1 rounded border border-[#057A4B]/40 bg-[#057A4B]/5 hover:bg-[#057A4B]/15 px-2.5 py-1 text-xs font-semibold text-[#065F46] transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>{lang === 'ur' ? 'پن تبدیل کریں' : 'Reset PIN'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestDelete(
                                lang === 'ur' ? 'طالب علم خارج / حذف کریں' : 'Delete Student',
                                lang === 'ur' ? `کیا آپ واقعی "${s.full_name_ur || s.full_name}" کا ریکارڈ حذف کرنا چاہتے ہیں؟` : `Delete student ${s.full_name}?`,
                                () => apiFetch(`/api/students/${s.id}`, { method: 'DELETE' }, user)
                              )
                            }
                            className="p-1.5 rounded hover:bg-red-50 text-red-700 transition-colors"
                            title={lang === 'ur' ? 'حذف کریں' : 'Delete'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Teacher Credentials & Status Manager */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDF2F7]">
              <h3 className="text-sm font-bold text-[#0B2545] flex items-center gap-2">
                <Users className="h-4 w-4 text-[#0B2545]" />
                <span>{lang === 'ur' ? `اساتذہ و مفتیان کے پاس ورڈز و حالت (${data.teachers.length})` : `Teachers Security & Status (${data.teachers.length})`}</span>
              </h3>
              <p className="text-xs text-[#627D98] mt-0.5">
                {lang === 'ur'
                  ? 'اساتذہ کا لاگ ان خفیہ پن تبدیل کریں یا ان کی حالت فعال / غیر فعال کریں۔'
                  : 'Reset teacher login PINs and manage account status in real-time.'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F4F7FA] text-[#486581]">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'کوڈ' : 'Code'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'استاذ کا نام' : 'Name'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'تخصص / ذمہ داری' : 'Specialization'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'موبائل نمبر' : 'Phone'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'اکاؤنٹ حالت' : 'Account Status'}</th>
                    <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'پاس ورڈ و سیکیورٹی ایکشن' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2F7]">
                  {data.teachers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono-code font-bold text-[#057A4B]">{t.teacher_code}</td>
                      <td className="px-4 py-3 font-semibold text-[#0B2545]">{pick(t.full_name, t.full_name_ur)}</td>
                      <td className="px-4 py-3 text-[#486581]">{t.specialization || 'تدریس و افتاء'}</td>
                      <td className="px-4 py-3 font-mono-code text-[#486581]" dir="ltr">{formatPakistaniMobile(t.phone)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={t.status || 'active'}
                          onChange={(e) => updateTeacherStatus(t.id, e.target.value)}
                          className={`rounded border text-xs px-2 py-1 font-semibold ${
                            t.status === 'active'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-red-300 bg-red-50 text-red-800'
                          }`}
                        >
                          <option value="active">{lang === 'ur' ? 'فعال (Active)' : 'Active'}</option>
                          <option value="inactive">{lang === 'ur' ? 'غیر فعال (Inactive)' : 'Inactive'}</option>
                          <option value="on_leave">{lang === 'ur' ? 'رخصت (On Leave)' : 'On Leave'}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPinModal({ type: 'teacher', id: t.id, name: t.full_name_ur || t.full_name, code: t.teacher_code, pin: '123456' })}
                            className="inline-flex items-center gap-1 rounded border border-[#0B2545]/40 bg-[#0B2545]/5 hover:bg-[#0B2545]/15 px-2.5 py-1 text-xs font-semibold text-[#0B2545] transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>{lang === 'ur' ? 'پن تبدیل کریں' : 'Reset PIN'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestDelete(
                                lang === 'ur' ? 'استاذ حذف کریں' : 'Delete Teacher',
                                lang === 'ur' ? `کیا آپ واقعی "${t.full_name_ur || t.full_name}" کا ریکارڈ حذف کرنا چاہتے ہیں؟` : `Delete teacher ${t.full_name}?`,
                                () => apiFetch(`/api/teachers/${t.id}`, { method: 'DELETE' }, user)
                              )
                            }
                            className="p-1.5 rounded hover:bg-red-50 text-red-700 transition-colors"
                            title={lang === 'ur' ? 'حذف کریں' : 'Delete'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: USERS & ROLES */}
      {tab === 'users' && (
        <div className="rounded-lg border border-[#D9E2EC] bg-white">
          <div className="px-5 py-4 border-b border-[#EDF2F7] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B2545]">
              {lang === 'ur' ? `صارفین و کردار (${data.profiles.length})` : `Staff & Researcher Profiles (${data.profiles.length})`}
            </h3>
            <button
              type="button"
              onClick={() => setProfileModal({ email: '', full_name: '', full_name_ur: '', phone: '', role_name: 'mufti', is_active: true })}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{lang === 'ur' ? 'نیا صارف' : 'Add User'}</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F4F7FA] text-[#486581]">
                <tr>
                  <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'نام' : 'Name'}</th>
                  <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'ای میل' : 'Email'}</th>
                  <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'عہدہ' : 'Role'}</th>
                  <th className="px-4 py-2.5 text-start">{lang === 'ur' ? 'حالت' : 'Active'}</th>
                  <th className="px-4 py-2.5 text-end">{lang === 'ur' ? 'عمل' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {data.profiles.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-[#0B2545]">{pick(p.full_name, p.full_name_ur)}</td>
                    <td className="px-4 py-3 font-mono-code text-[#486581]" dir="ltr">{p.email}</td>
                    <td className="px-4 py-3">{pick(p.role_title_en || p.role_name, p.role_title_ur || p.role_name)}</td>
                    <td className="px-4 py-3">{p.is_active ? (lang === 'ur' ? 'فعال' : 'Active') : lang === 'ur' ? 'معطل' : 'Disabled'}</td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setProfileModal({ ...p, is_active: Boolean(p.is_active) })}
                          className="p-1.5 rounded hover:bg-[#E2E8F0]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {p.id !== 'prof-admin' && (
                          <button
                            type="button"
                            onClick={() =>
                              requestDelete(
                                lang === 'ur' ? 'صارف حذف کریں' : 'Delete User',
                                lang === 'ur' ? `"${p.full_name_ur || p.full_name}" کا اکاؤنٹ حذف کریں؟` : `Delete user ${p.full_name}?`,
                                () => apiFetch(`/api/admin/profiles/${p.id}`, { method: 'DELETE' }, user)
                              )
                            }
                            className="p-1.5 rounded hover:bg-red-50 text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: AUDIT LOGS */}
      {tab === 'audit' && (
        <div className="rounded-lg border border-[#D9E2EC] bg-white">
          <div className="px-5 py-4 border-b border-[#EDF2F7]">
            <h3 className="text-sm font-bold text-[#0B2545]">{lang === 'ur' ? 'نظامی آڈٹ لاگ' : 'System Audit Trail'}</h3>
          </div>
          <div className="divide-y divide-[#EDF2F7]">
            {data.auditLogs.map((al: any) => (
              <div key={al.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-mono-code font-semibold text-[#0B2545]">{al.action}</div>
                  <div className="text-[#486581]">
                    {al.actor_name} · {al.entity_type} · {al.details}
                  </div>
                </div>
                <span className="font-mono-code text-[11px] text-[#627D98] shrink-0">{(al.created_at || '').slice(0, 19)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {studentModal && (
        <Modal title={studentModal.id ? (lang === 'ur' ? 'طالب علم میں ترمیم' : 'Edit Student') : lang === 'ur' ? 'نیا طالب علم' : 'New Student'} onClose={() => setStudentModal(null)}>
          <form onSubmit={saveStudent} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder={lang === 'ur' ? 'مکمل نام' : 'Full Name'} value={studentModal.full_name || ''} onChange={(e) => setStudentModal({ ...studentModal, full_name: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input placeholder={lang === 'ur' ? 'مکمل نام' : 'Full Name'} dir="rtl" value={studentModal.full_name_ur || ''} onChange={(e) => setStudentModal({ ...studentModal, full_name_ur: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input required placeholder={lang === 'ur' ? 'ولدیت' : 'Father Name'} value={studentModal.father_name || ''} onChange={(e) => setStudentModal({ ...studentModal, father_name: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input placeholder={lang === 'ur' ? 'ولدیت' : 'Father Name'} dir="rtl" value={studentModal.father_name_ur || ''} onChange={(e) => setStudentModal({ ...studentModal, father_name_ur: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input required placeholder="03001234567" dir="ltr" value={studentModal.phone || ''} onChange={(e) => setStudentModal({ ...studentModal, phone: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
              <select value={studentModal.class_id || ''} onChange={(e) => setStudentModal({ ...studentModal, class_id: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2">
                {data.classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{pick(cls.name_en, cls.name_ur)}</option>
                ))}
              </select>
              <select value={studentModal.status || 'active'} onChange={(e) => setStudentModal({ ...studentModal, status: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2">
                <option value="active">{lang === 'ur' ? 'فعال' : 'Active'}</option>
                <option value="on_leave">{lang === 'ur' ? 'رخصت' : 'On Leave'}</option>
                <option value="graduated">{lang === 'ur' ? 'فارغ التحصیل' : 'Graduated'}</option>
                <option value="suspended">{lang === 'ur' ? 'معطل' : 'Suspended'}</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setStudentModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {teacherModal && (
        <Modal title={teacherModal.id ? (lang === 'ur' ? 'استاذ میں ترمیم' : 'Edit Teacher') : lang === 'ur' ? 'نیا استاذ' : 'New Teacher'} onClose={() => setTeacherModal(null)}>
          <form onSubmit={saveTeacher} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder={lang === 'ur' ? 'نام (انگریزی)' : 'Full Name (EN)'} value={teacherModal.full_name || ''} onChange={(e) => setTeacherModal({ ...teacherModal, full_name: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input placeholder={lang === 'ur' ? 'نام (اردو)' : 'Full Name (UR)'} dir="rtl" value={teacherModal.full_name_ur || ''} onChange={(e) => setTeacherModal({ ...teacherModal, full_name_ur: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input required placeholder={lang === 'ur' ? 'اہلیت (انگریزی)' : 'Qualification (EN)'} value={teacherModal.qualification || ''} onChange={(e) => setTeacherModal({ ...teacherModal, qualification: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input placeholder={lang === 'ur' ? 'اہلیت (اردو)' : 'Qualification (UR)'} dir="rtl" value={teacherModal.qualification_ur || ''} onChange={(e) => setTeacherModal({ ...teacherModal, qualification_ur: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input required placeholder="03001234567" dir="ltr" value={teacherModal.phone || ''} onChange={(e) => setTeacherModal({ ...teacherModal, phone: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
              <input placeholder={lang === 'ur' ? 'ای میل' : 'Email'} value={teacherModal.email || ''} onChange={(e) => setTeacherModal({ ...teacherModal, email: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTeacherModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {classModal && (
        <Modal title={lang === 'ur' ? 'درجہ (Class)' : 'Class Details'} onClose={() => setClassModal(null)}>
          <form onSubmit={saveClass} className="space-y-3 text-xs">
            <input required placeholder="Code (e.g. TAKH-1)" value={classModal.code || ''} onChange={(e) => setClassModal({ ...classModal, code: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
            <input required placeholder="Name (EN)" value={classModal.name_en || ''} onChange={(e) => setClassModal({ ...classModal, name_en: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="نام (اردو)" dir="rtl" value={classModal.name_ur || ''} onChange={(e) => setClassModal({ ...classModal, name_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setClassModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {batchModal && (
        <Modal title={lang === 'ur' ? 'نیا بیچ' : 'Add Batch'} onClose={() => setBatchModal(null)}>
          <form onSubmit={saveBatch} className="space-y-3 text-xs">
            <select value={batchModal.class_id} onChange={(e) => setBatchModal({ ...batchModal, class_id: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2">
              {data.classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{pick(cls.name_en, cls.name_ur)}</option>
              ))}
            </select>
            <input required placeholder="Batch Name (EN)" value={batchModal.name_en || ''} onChange={(e) => setBatchModal({ ...batchModal, name_en: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="بیچ کا نام (اردو)" dir="rtl" value={batchModal.name_ur || ''} onChange={(e) => setBatchModal({ ...batchModal, name_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input type="number" placeholder="Capacity" value={batchModal.capacity || 30} onChange={(e) => setBatchModal({ ...batchModal, capacity: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setBatchModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {subjectModal && (
        <Modal title={lang === 'ur' ? 'مضمون (Subject)' : 'Subject Details'} onClose={() => setSubjectModal(null)}>
          <form onSubmit={saveSubject} className="space-y-3 text-xs">
            <input required placeholder="Code (e.g. FIQH-201)" value={subjectModal.code || ''} onChange={(e) => setSubjectModal({ ...subjectModal, code: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
            <input required placeholder="Name (EN)" value={subjectModal.name_en || ''} onChange={(e) => setSubjectModal({ ...subjectModal, name_en: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="نام (اردو)" dir="rtl" value={subjectModal.name_ur || ''} onChange={(e) => setSubjectModal({ ...subjectModal, name_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSubjectModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {bookModal && (
        <Modal title={lang === 'ur' ? 'کتاب (Book)' : 'Book Details'} onClose={() => setBookModal(null)}>
          <form onSubmit={saveBook} className="space-y-3 text-xs">
            <select value={bookModal.subject_id} onChange={(e) => setBookModal({ ...bookModal, subject_id: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2">
              {data.subjects.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{pick(sub.name_en, sub.name_ur)}</option>
              ))}
            </select>
            <input required placeholder="Book Title (EN)" value={bookModal.title_en || ''} onChange={(e) => setBookModal({ ...bookModal, title_en: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="کتاب کا نام (اردو)" dir="rtl" value={bookModal.title_ur || ''} onChange={(e) => setBookModal({ ...bookModal, title_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input placeholder="Author" value={bookModal.author || ''} onChange={(e) => setBookModal({ ...bookModal, author: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setBookModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {lessonModal && (
        <Modal title={lang === 'ur' ? 'سبق میں ترمیم' : 'Edit Lesson'} onClose={() => setLessonModal(null)}>
          <form onSubmit={saveLesson} className="space-y-3 text-xs">
            <input type="date" value={lessonModal.lesson_date || ''} onChange={(e) => setLessonModal({ ...lessonModal, lesson_date: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
            <input required placeholder="Start Position" value={lessonModal.start_position || ''} onChange={(e) => setLessonModal({ ...lessonModal, start_position: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="End Position" value={lessonModal.end_position || ''} onChange={(e) => setLessonModal({ ...lessonModal, end_position: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input placeholder="Homework" value={lessonModal.homework || ''} onChange={(e) => setLessonModal({ ...lessonModal, homework: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setLessonModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {examModal && (
        <Modal title={lang === 'ur' ? 'امتحان میں ترمیم' : 'Edit Exam'} onClose={() => setExamModal(null)}>
          <form onSubmit={saveExam} className="space-y-3 text-xs">
            <input required placeholder="Title (EN)" value={examModal.title_en || ''} onChange={(e) => setExamModal({ ...examModal, title_en: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="عنوان (اردو)" dir="rtl" value={examModal.title_ur || ''} onChange={(e) => setExamModal({ ...examModal, title_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <select value={examModal.status || 'scheduled'} onChange={(e) => setExamModal({ ...examModal, status: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2">
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="published">Published</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setExamModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {fatwaModal && (
        <Modal title={fatwaModal.id ? (lang === 'ur' ? 'استفتاء میں ترمیم' : 'Edit Fatwa Question') : lang === 'ur' ? 'نیا سوال' : 'New Question'} onClose={() => setFatwaModal(null)}>
          <form onSubmit={saveFatwaQuestion} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder={lang === 'ur' ? 'سائل کا نام' : 'Questioner Name'} value={fatwaModal.questioner_name || ''} onChange={(e) => setFatwaModal({ ...fatwaModal, questioner_name: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input placeholder={lang === 'ur' ? 'موبائل' : 'Phone'} value={fatwaModal.questioner_phone || ''} onChange={(e) => setFatwaModal({ ...fatwaModal, questioner_phone: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <select value={fatwaModal.category_id || ''} onChange={(e) => setFatwaModal({ ...fatwaModal, category_id: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2">
                {data.fatwaCategories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{pick(cat.name_en, cat.name_ur)}</option>
                ))}
              </select>
              {fatwaModal.id && (
                <select value={fatwaModal.workflow_status || 'registered'} onChange={(e) => setFatwaModal({ ...fatwaModal, workflow_status: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2">
                  <option value="registered">Registered</option>
                  <option value="assigned">Assigned</option>
                  <option value="research">Under Research</option>
                  <option value="draft">Draft</option>
                  <option value="senior_review">Senior Review</option>
                  <option value="final_approval">Final Approval</option>
                  <option value="issued">Issued</option>
                </select>
              )}
              <input required placeholder={lang === 'ur' ? 'موضوع (انگریزی)' : 'Subject (EN)'} value={fatwaModal.subject_title || ''} onChange={(e) => setFatwaModal({ ...fatwaModal, subject_title: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
              <input placeholder={lang === 'ur' ? 'موضوع (اردو)' : 'Subject (UR)'} dir="rtl" value={fatwaModal.subject_title_ur || ''} onChange={(e) => setFatwaModal({ ...fatwaModal, subject_title_ur: e.target.value })} className="rounded border border-[#D9E2EC] px-3 py-2" />
            </div>
            <textarea required rows={4} placeholder={lang === 'ur' ? 'مکمل سوال' : 'Complete Question'} value={fatwaModal.question_text || ''} onChange={(e) => setFatwaModal({ ...fatwaModal, question_text: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFatwaModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {catModal && (
        <Modal title={lang === 'ur' ? 'فقہی شعبہ' : 'Fatwa Category'} onClose={() => setCatModal(null)}>
          <form onSubmit={saveCategory} className="space-y-3 text-xs">
            <input required placeholder="Code (e.g. NIKAH)" value={catModal.code || ''} onChange={(e) => setCatModal({ ...catModal, code: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
            <input required placeholder="Name (EN)" value={catModal.name_en || ''} onChange={(e) => setCatModal({ ...catModal, name_en: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required placeholder="نام (اردو)" dir="rtl" value={catModal.name_ur || ''} onChange={(e) => setCatModal({ ...catModal, name_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input placeholder="عربی نام (Optional)" dir="rtl" value={catModal.name_ar || ''} onChange={(e) => setCatModal({ ...catModal, name_ar: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2 font-arabic" />
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean(catModal.is_active)} onChange={(e) => setCatModal({ ...catModal, is_active: e.target.checked })} />
              <span>{lang === 'ur' ? 'فعال' : 'Active'}</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCatModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {profileModal && (
        <Modal title={profileModal.id ? (lang === 'ur' ? 'صارف میں ترمیم' : 'Edit User') : lang === 'ur' ? 'نیا صارف' : 'Add User'} onClose={() => setProfileModal(null)}>
          <form onSubmit={saveProfile} className="space-y-3 text-xs">
            <input required placeholder="Full Name (EN)" value={profileModal.full_name || ''} onChange={(e) => setProfileModal({ ...profileModal, full_name: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input placeholder="نام (اردو)" dir="rtl" value={profileModal.full_name_ur || ''} onChange={(e) => setProfileModal({ ...profileModal, full_name_ur: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2" />
            <input required type="email" dir="ltr" placeholder="Email" value={profileModal.email || ''} onChange={(e) => setProfileModal({ ...profileModal, email: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2 font-mono-code" />
            <select value={profileModal.role_name || 'mufti'} onChange={(e) => setProfileModal({ ...profileModal, role_name: e.target.value })} className="w-full rounded border border-[#D9E2EC] px-3 py-2">
              {data.roles.map((r: any) => (
                <option key={r.id} value={r.name}>{pick(r.title_en, r.title_ur)}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean(profileModal.is_active)} onChange={(e) => setProfileModal({ ...profileModal, is_active: e.target.checked })} />
              <span>{lang === 'ur' ? 'اکاؤنٹ فعال ہے' : 'Account Active'}</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setProfileModal(null)} className="rounded border border-[#D9E2EC] px-4 py-2">{lang === 'ur' ? 'منسوخ' : 'Cancel'}</button>
              <button type="submit" className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white">{lang === 'ur' ? 'محفوظ کریں' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {pinModal && (
        <Modal
          title={lang === 'ur' ? `${pinModal.name} کا لاگ ان پن تبدیل کریں` : `Reset PIN for ${pinModal.name}`}
          onClose={() => setPinModal(null)}
        >
          <form onSubmit={savePin} className="space-y-4 text-xs font-urdu">
            <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs flex justify-between items-center">
              <div>
                <span className="text-[#627D98]">{lang === 'ur' ? 'نام:' : 'Name:'} </span>
                <span className="font-bold text-[#0B2545]">{pinModal.name}</span>
              </div>
              <span className="font-mono-code font-bold px-2 py-0.5 rounded bg-[#057A4B]/10 text-[#057A4B]">
                {pinModal.code}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'نیا خفیہ پن (PIN)' : 'New PIN'}
              </label>
              <div className="relative">
                <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  dir="ltr"
                  required
                  placeholder="کم از کم 4 ہندسے"
                  value={pinModal.pin}
                  onChange={(e) => setPinModal({ ...pinModal, pin: e.target.value })}
                  className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                    lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
              <p className="text-[11px] text-[#627D98] mt-1">
                {lang === 'ur' ? 'طالب علم یا استاذ اس پن کے ذریعے اپنے ڈیش بورڈ میں لاگ ان ہو سکیں گے۔' : 'User will use this PIN to log in.'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPinModal(null)}
                className="rounded border border-[#D9E2EC] px-4 py-2 hover:bg-[#F4F7FA] font-medium"
              >
                {lang === 'ur' ? 'منسوخ' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="rounded bg-[#057A4B] px-4 py-2 font-semibold text-white hover:bg-[#04633D]"
              >
                {lang === 'ur' ? 'پن محفوظ کریں' : 'Save PIN'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={true}
          danger={true}
          title={confirmDelete.title}
          message={confirmDelete.message}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 overflow-y-auto">
    <div className="w-full max-w-xl rounded-lg border border-[#D9E2EC] bg-white shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#EDF2F7] px-4 sm:px-5 py-3.5">
        <h3 className="text-sm font-bold text-[#0B2545]">{title}</h3>
        <button type="button" onClick={onClose} className="p-1 text-[#486581] hover:text-[#0B2545]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  </div>
);
