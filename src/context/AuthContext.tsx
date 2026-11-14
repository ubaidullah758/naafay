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
  },
};

interface AuthContextValue {
  user: ActiveUser | null;
  signInAsRole: (role: UserRole) => void;
  loginAdminWithCredentials: (email: string, accessCode: string) => Promise<void>;
  signOut: () => void;
  // Academic permissions
  canManageStudents: boolean;
  canDeleteStudents: boolean;
  canMarkAttendance: boolean;
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
    if (saved && ROLE_PERSONAS[saved]) return ROLE_PERSONAS[saved];
    return ROLE_PERSONAS.admin;
  });

  const signInAsRole = (role: UserRole) => {
    const persona = ROLE_PERSONAS[role];
    setUser(persona);
    localStorage.setItem('naafay_active_role', role);
  };

  const loginAdminWithCredentials = async (email: string, accessCode: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, accessCode }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error_ur || json.error || 'Admin login failed');
    }
    setUser(json.user);
    localStorage.setItem('naafay_active_role', 'admin');
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('naafay_active_role');
  };

  const role = user?.role;
  const isMuftiOrSenior = role === 'mufti' || role === 'senior_mufti';

  return (
    <AuthContext.Provider
      value={{
        user,
        signInAsRole,
        loginAdminWithCredentials,
        signOut,
        canManageStudents: role === 'admin' || role === 'office_staff',
        canDeleteStudents: role === 'admin',
        canMarkAttendance: role === 'admin' || role === 'office_staff' || isMuftiOrSenior,
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
