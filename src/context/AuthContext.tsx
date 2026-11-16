import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'admin' | 'senior_mufti' | 'mufti' | 'office_staff' | 'student';

export interface ActiveUser {
  profileId: string;
  role: UserRole;
  nameEn: string;
  nameUr: string;
  email: string;
  teacherId?: string;
  studentId?: string;
  studentCode?: string;
  classId?: string;
  classNameUr?: string;
  fatherNameUr?: string;
}

export const ROLE_PERSONAS: Record<UserRole, ActiveUser> = {
  admin: {
    profileId: 'prof-admin',
    role: 'admin',
    nameEn: 'Mufti Waris Naseeb',
    nameUr: 'مفتی وارث نصیب',
    email: 'nazim@naafay.edu.pk',
  },
  senior_mufti: {
    profileId: 'prof-teacher-2',
    role: 'senior_mufti',
    nameEn: 'Mufti Khalid Saifullah (Senior Mufti)',
    nameUr: 'مفتی خالد سیف اللہ (مفتیِ اعظم)',
    email: 'mufti.khalid@naafay.edu.pk',
    teacherId: 'tch-2',
  },
  mufti: {
    profileId: 'prof-teacher-1',
    role: 'mufti',
    nameEn: 'Mufti Salman Mansoorpuri',
    nameUr: 'مفتی سلمان منصورپوری',
    email: 'mufti.salman@naafay.edu.pk',
    teacherId: 'tch-1',
  },
  office_staff: {
    profileId: 'prof-staff',
    role: 'office_staff',
    nameEn: 'Maulana Zubair Ahmad',
    nameUr: 'مولانا زبیر احمد',
    email: 'office@naafay.edu.pk',
  },
  student: {
    profileId: 'prof-student-1',
    role: 'student',
    nameEn: 'Maulana Abdur Rahman Madani',
    nameUr: 'مولانا عبدالرحمٰن مدنی',
    email: 'abdurrahman@naafay.edu.pk',
    studentId: 'stu-1',
    studentCode: 'ST-001',
    classId: 'cls-tak1',
    classNameUr: 'تخصص فی الفقہ — سالِ اول',
  },
};

interface AuthContextValue {
  user: ActiveUser | null;
  signInAsRole: (role: UserRole) => void;
  loginAdminWithCredentials: (email: string, accessCode: string) => Promise<void>;
  loginStudentWithCredentials: (studentCode: string, pin: string) => Promise<ActiveUser>;
  loginTeacherWithCredentials: (teacherCode: string, pin: string) => Promise<ActiveUser>;
  signOut: () => void;
  // Academic permissions
  canManageStudents: boolean;
  canDeleteStudents: boolean;
  canMarkAttendance: boolean;
  canMarkOwnAttendance: boolean;
  canReviewMutala: boolean;
  canRecordLessons: boolean;
  canManageExams: boolean;
  canReviewResearch: boolean;
  // Dar-ul-Ifta permissions
  canRegisterFatwa: boolean;
  canManageCategories: boolean;
  canAssignFatwa: boolean;
  canSeniorReviewFatwa: boolean;
  canFinalApproveFatwa: boolean;
  canControlPublication: boolean;
  canViewQuestionerPrivacy: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ActiveUser | null>(() => {
    const saved = localStorage.getItem('naafay_active_role') as UserRole | null;
    if (!saved) return null; // Never auto-login unauthenticated visitors!

    if (saved === 'student') {
      const storedStu = localStorage.getItem('naafay_active_student_user');
      if (storedStu) {
        try {
          return JSON.parse(storedStu);
        } catch {
          // fallback
        }
      }
      return ROLE_PERSONAS.student;
    }
    if (saved === 'teacher' || saved === 'mufti' || saved === 'senior_mufti') {
      const storedTch = localStorage.getItem('naafay_active_teacher_user');
      if (storedTch) {
        try {
          return JSON.parse(storedTch);
        } catch {
          // fallback
        }
      }
      return ROLE_PERSONAS[saved] || ROLE_PERSONAS.mufti;
    }
    if (saved === 'admin') {
      const storedAdm = localStorage.getItem('naafay_active_admin_user');
      if (storedAdm) {
        try {
          return JSON.parse(storedAdm);
        } catch {}
      }
      return ROLE_PERSONAS.admin;
    }
    if (saved && ROLE_PERSONAS[saved]) return ROLE_PERSONAS[saved];
    return null;
  });

  const signInAsRole = (role: UserRole) => {
    const persona = ROLE_PERSONAS[role];
    setUser(persona);
    localStorage.setItem('naafay_active_role', role);
    if (role === 'admin') {
      localStorage.setItem('naafay_active_admin_user', JSON.stringify(persona));
      localStorage.removeItem('naafay_active_student_user');
      localStorage.removeItem('naafay_active_teacher_user');
    } else if (role !== 'student') {
      localStorage.removeItem('naafay_active_student_user');
    }
  };

  const loginAdminWithCredentials = async (email: string, accessCode: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, accessCode }),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // response wasn't valid JSON
    }
    if (!res.ok) {
      throw new Error(json?.error_ur || json?.error || 'ایڈمن لاگ ان ناکام رہا / Admin login failed');
    }
    if (!json?.user) {
      throw new Error('ایڈمن پروفائل موصول نہیں ہوا');
    }
    setUser(json.user);
    localStorage.setItem('naafay_active_role', 'admin');
    localStorage.setItem('naafay_active_admin_user', JSON.stringify(json.user));
    localStorage.removeItem('naafay_active_student_user');
    localStorage.removeItem('naafay_active_teacher_user');
  };

  const loginStudentWithCredentials = async (mobileOrCode: string, pin: string): Promise<ActiveUser> => {
    const res = await fetch('/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobileOrCode, studentCode: mobileOrCode, pin }),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // response wasn't valid JSON
    }
    if (!res.ok) {
      throw new Error(json?.error_ur || json?.error || 'طالب علم کا لاگ ان ناکام رہا / Student login failed');
    }
    const stuUser: ActiveUser = json?.user;
    if (!stuUser) {
      throw new Error('طالب علم کا ڈیٹا موصول نہیں ہوا');
    }
    setUser(stuUser);
    localStorage.setItem('naafay_active_role', 'student');
    localStorage.setItem('naafay_active_student_user', JSON.stringify(stuUser));
    localStorage.removeItem('naafay_active_teacher_user');
    return stuUser;
  };

  const loginTeacherWithCredentials = async (teacherCode: string, pin: string): Promise<ActiveUser> => {
    const res = await fetch('/api/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherCode, pin }),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // response wasn't valid JSON
    }
    if (!res.ok) {
      throw new Error(json?.error_ur || json?.error || 'استاذ کا لاگ ان ناکام رہا / Teacher login failed');
    }
    const tchUser: ActiveUser = json?.user;
    if (!tchUser) {
      throw new Error('استاذ کا ڈیٹا موصول نہیں ہوا');
    }
    setUser(tchUser);
    localStorage.setItem('naafay_active_role', tchUser.role);
    localStorage.setItem('naafay_active_teacher_user', JSON.stringify(tchUser));
    localStorage.removeItem('naafay_active_student_user');
    return tchUser;
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('naafay_active_role');
    localStorage.removeItem('naafay_active_admin_user');
    localStorage.removeItem('naafay_active_student_user');
    localStorage.removeItem('naafay_active_teacher_user');
  };

  const role = user?.role;
  const isMuftiOrSenior = role === 'mufti' || role === 'senior_mufti';

  return (
    <AuthContext.Provider
      value={{
        user,
        signInAsRole,
        loginAdminWithCredentials,
        loginStudentWithCredentials,
        loginTeacherWithCredentials,
        signOut,
        canManageStudents: role === 'admin' || role === 'office_staff',
        canDeleteStudents: role === 'admin',
        canMarkAttendance: role === 'admin' || role === 'office_staff' || isMuftiOrSenior,
        canMarkOwnAttendance: role === 'student',
        canReviewMutala: role === 'admin' || isMuftiOrSenior,
        canRecordLessons: role === 'admin' || isMuftiOrSenior,
        canManageExams: role === 'admin' || role === 'office_staff' || isMuftiOrSenior,
        canReviewResearch: role === 'admin' || isMuftiOrSenior,
        canRegisterFatwa: role === 'admin' || role === 'office_staff' || isMuftiOrSenior,
        canManageCategories: role === 'admin',
        canAssignFatwa: role === 'admin' || role === 'senior_mufti',
        canSeniorReviewFatwa: role === 'admin' || role === 'senior_mufti',
        canFinalApproveFatwa: role === 'admin',
        canControlPublication: role === 'admin',
        canViewQuestionerPrivacy: role === 'admin' || role === 'office_staff' || role === 'senior_mufti',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
