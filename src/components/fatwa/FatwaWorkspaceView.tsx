import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Globe,
  History,
  List,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Type,
  UserPlus,
  Users,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, fileToDataUrl } from '../../lib/api';
import { exportToPdf } from '../../lib/exports';
import { StatusText } from '../StatusText';

interface FatwaWorkspaceViewProps {
  fatwaId: string;
  onBack: () => void;
}

type WorkspaceTab = 'question' | 'research' | 'draft' | 'review' | 'document';

const WORKFLOW_STEPS = [
  'received',
  'registered',
  'assigned',
  'research',
  'draft',
  'senior_review',
  'final_approval',
  'issued',
] as const;

export const FatwaWorkspaceView: React.FC<FatwaWorkspaceViewProps> = ({ fatwaId, onBack }) => {
  const { lang, t, pick } = useLanguage();
  const {
    user,
    canAssignFatwa,
    canSeniorReviewFatwa,
    canFinalApproveFatwa,
    canControlPublication,
    canViewQuestionerPrivacy,
  } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [lookups, setLookups] = useState<{ categories: any[]; assignees: any[] }>({ categories: [], assignees: [] });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('question');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Assignment form
  const [assignForm, setAssignForm] = useState({
    assignee_profile_id: '',
    assignee_role: 'researcher',
    deadline: '',
    instructions: '',
  });

  // Research form
  const [researchForm, setResearchForm] = useState({
    research_notes: '',
    related_books: '',
    arabic_quotations: '',
    urdu_explanation: '',
    fiqhi_opinions: '',
    supporting_evidence: '',
    researcher_comments: '',
  });

  // Reference form & reusable search
  const [refForm, setRefForm] = useState({
    book_name: '',
    author: '',
    volume: '',
    page_number: '',
    chapter: '',
    arabic_quotation: '',
    explanation: '',
    reference_notes: '',
  });
  const [reusableQuery, setReusableQuery] = useState('');
  const [reusableRefs, setReusableRefs] = useState<any[]>([]);

  // Draft editor state + autosave
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUr, setDraftUr] = useState('');
  const [draftAr, setDraftAr] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const draftLoadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const urduEditorRef = useRef<HTMLTextAreaElement>(null);

  // Senior review & Nazim final approval
  const [seniorForm, setSeniorForm] = useState<{ decision: 'approved_for_final' | 'corrections_requested' | 'returned'; comments: string }>({
    decision: 'approved_for_final',
    comments: '',
  });
  const [finalComments, setFinalComments] = useState('');

  // Public publication control
  const [pubForm, setPubForm] = useState({
    is_published: false,
    public_title_ur: '',
    public_title_en: '',
    public_question_text: '',
    public_answer_text: '',
  });

  const notify = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadWorkspace = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ws, lkp] = await Promise.all([
        apiFetch(`/api/fatwa/questions/${fatwaId}`, {}, user),
        apiFetch('/api/fatwa/lookups', {}, user),
      ]);
      const normalizedWs = {
        question: ws.question || ws,
        draft: ws.draft || null,
        drafts: Array.isArray(ws.drafts) ? ws.drafts : [],
        references: Array.isArray(ws.references) ? ws.references : [],
        documents: Array.isArray(ws.documents) ? ws.documents : [],
        attachments: Array.isArray(ws.attachments) ? ws.attachments : [],
        assignments: Array.isArray(ws.assignments) ? ws.assignments : [],
        research: Array.isArray(ws.research) ? ws.research : [],
        versions: Array.isArray(ws.versions) ? ws.versions : [],
        reviews: Array.isArray(ws.reviews) ? ws.reviews : [],
        approvals: Array.isArray(ws.approvals) ? ws.approvals : [],
        publication: ws.publication || null,
      };
      setData(normalizedWs);
      setLookups({
        categories: Array.isArray(lkp?.categories) ? lkp.categories : [],
        assignees: Array.isArray(lkp?.assignees) ? lkp.assignees : [],
        ...(lkp || {}),
      });

      draftLoadedRef.current = false;
      setDraftTitle(ws.draft?.draft_title || ws.question.subject_title_ur || ws.question.subject_title || '');
      setDraftUr(ws.draft?.draft_body_ur || '');
      setDraftAr(ws.draft?.draft_body_ar || '');
      setLastSavedAt(ws.draft?.autosaved_at || null);
      dirtyRef.current = false;
      setTimeout(() => {
        draftLoadedRef.current = true;
      }, 80);

      setPubForm({
        is_published: ws.question.publication_status === 'published',
        public_title_ur: ws.publication?.public_title_ur || ws.question.subject_title_ur || '',
        public_title_en: ws.publication?.public_title_en || ws.question.subject_title || '',
        public_question_text: ws.publication?.public_question_text || ws.question.question_text || '',
        public_answer_text: ws.publication?.public_answer_text || ws.draft?.draft_body_ur || '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [fatwaId, user?.role, user?.profileId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      apiFetch(`/api/fatwa/references/search?q=${encodeURIComponent(reusableQuery)}`, {}, user)
        .then((rows) => setReusableRefs(rows))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [reusableQuery, user?.profileId]);

  // Debounced autosave for Draft Answer Editor (skips if fatwa is already issued)
  useEffect(() => {
    if (!draftLoadedRef.current || !dirtyRef.current) return;
    if (!data?.question || data.question.workflow_status === 'issued') return;

    setAutosaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/fatwa/questions/${fatwaId}/draft`,
          {
            method: 'PUT',
            body: JSON.stringify({
              draft_title: draftTitle,
              draft_body_ur: draftUr,
              draft_body_ar: draftAr,
            }),
          },
          user
        );
        dirtyRef.current = false;
        setAutosaveState('saved');
        setLastSavedAt(res.draft?.autosaved_at || new Date().toISOString());
      } catch {
        setAutosaveState('error');
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [draftTitle, draftUr, draftAr]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.assignee_profile_id) return;
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/assign`,
        {
          method: 'POST',
          body: JSON.stringify(assignForm),
        },
        user
      );
      setAssignForm({ assignee_profile_id: '', assignee_role: 'researcher', deadline: '', instructions: '' });
      notify('success', lang === 'ur' ? 'استفتاء کامیابی سے تفویض کر دیا گیا' : 'Assignee added successfully');
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleAddResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchForm.research_notes.trim()) return;
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/research`,
        {
          method: 'POST',
          body: JSON.stringify(researchForm),
        },
        user
      );
      setResearchForm({
        research_notes: '',
        related_books: '',
        arabic_quotations: '',
        urdu_explanation: '',
        fiqhi_opinions: '',
        supporting_evidence: '',
        researcher_comments: '',
      });
      notify('success', lang === 'ur' ? 'تحقیقی نوٹ محفوظ ہو گیا' : 'Research entry saved');
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refForm.book_name.trim() || !refForm.arabic_quotation.trim()) return;
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/references`,
        {
          method: 'POST',
          body: JSON.stringify(refForm),
        },
        user
      );
      setRefForm({
        book_name: '',
        author: '',
        volume: '',
        page_number: '',
        chapter: '',
        arabic_quotation: '',
        explanation: '',
        reference_notes: '',
      });
      notify('success', lang === 'ur' ? 'کتابی حوالہ شامل کر دیا گیا' : 'Reference added to question');
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleReuseReference = async (refItem: any) => {
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/references`,
        {
          method: 'POST',
          body: JSON.stringify({
            book_name: refItem.book_name,
            author: refItem.author,
            volume: refItem.volume,
            page_number: refItem.page_number,
            chapter: refItem.chapter,
            arabic_quotation: refItem.arabic_quotation,
            explanation: refItem.explanation,
            reference_notes: refItem.reference_notes,
          }),
        },
        user
      );
      notify('success', lang === 'ur' ? 'حوالہ اس استفتاء میں شامل ہو گیا' : 'Reusable reference attached');
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleDeleteReference = async (refId: string) => {
    try {
      await apiFetch(`/api/fatwa/references/${refId}`, { method: 'DELETE' }, user);
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const insertAtCursor = (snippet: string) => {
    const el = urduEditorRef.current;
    dirtyRef.current = true;
    if (!el) {
      setDraftUr((prev) => `${prev}${prev ? '\n\n' : ''}${snippet}`);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const updated = draftUr.slice(0, start) + snippet + draftUr.slice(end);
    setDraftUr(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 20);
  };

  const handleSaveDraft = async (opts: { saveVersion?: boolean; submitForSeniorReview?: boolean }) => {
    try {
      const res = await apiFetch(
        `/api/fatwa/questions/${fatwaId}/draft`,
        {
          method: 'PUT',
          body: JSON.stringify({
            draft_title: draftTitle,
            draft_body_ur: draftUr,
            draft_body_ar: draftAr,
            saveVersion: opts.saveVersion,
            submitForSeniorReview: opts.submitForSeniorReview,
            changeSummary: changeSummary.trim() || undefined,
          }),
        },
        user
      );
      dirtyRef.current = false;
      setAutosaveState('saved');
      setLastSavedAt(res.draft?.autosaved_at || new Date().toISOString());
      setChangeSummary('');
      notify(
        'success',
        opts.submitForSeniorReview
          ? lang === 'ur'
            ? 'مسودہ مفتیِ اعظم کو برائے جائزہ ارسال کر دیا گیا'
            : 'Draft submitted for Senior Mufti Review'
          : lang === 'ur'
            ? 'نیا ورژن محفوظ کر لیا گیا'
            : 'Version snapshot saved'
      );
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleRestoreVersion = (ver: any) => {
    dirtyRef.current = true;
    setDraftUr(ver.draft_body_ur || '');
    setDraftAr(ver.draft_body_ar || '');
    notify(
      'success',
      lang === 'ur'
        ? `ورژن #${ver.version_number} ایڈیٹر میں بحال کر دیا گیا`
        : `Version #${ver.version_number} loaded into editor`
    );
  };

  const handleSeniorReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seniorForm.comments.trim()) {
      notify('error', lang === 'ur' ? 'جائزے کے لیے تبصرہ لکھنا ضروری ہے' : 'Review comments are required');
      return;
    }
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/senior-review`,
        {
          method: 'POST',
          body: JSON.stringify(seniorForm),
        },
        user
      );
      setSeniorForm({ decision: 'approved_for_final', comments: '' });
      notify('success', lang === 'ur' ? 'مفتیِ اعظم کا جائزہ محفوظ ہو گیا' : 'Senior Mufti review recorded');
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleFinalApproval = async (decision: 'issued' | 'returned_to_review') => {
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/final-approval`,
        {
          method: 'POST',
          body: JSON.stringify({ decision, comments: finalComments }),
        },
        user
      );
      setFinalComments('');
      notify(
        'success',
        decision === 'issued'
          ? lang === 'ur'
            ? 'فتویٰ حتمی منظوری کے ساتھ جاری کر دیا گیا'
            : 'Fatwa approved and issued with official Fatwa Number'
          : lang === 'ur'
            ? 'فتویٰ دوبارہ نظرثانی کے لیے واپس بھیجا گیا'
            : 'Returned to Senior Review'
      );
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handlePublicationSave = async (publishTarget: boolean) => {
    try {
      await apiFetch(
        `/api/fatwa/questions/${fatwaId}/publication`,
        {
          method: 'POST',
          body: JSON.stringify({
            is_published: publishTarget,
            public_title_ur: pubForm.public_title_ur,
            public_title_en: pubForm.public_title_en,
            public_question_text: pubForm.public_question_text,
            public_answer_text: pubForm.public_answer_text,
          }),
        },
        user
      );
      notify(
        'success',
        publishTarget
          ? lang === 'ur'
            ? 'فتویٰ پبلک پورٹل پر (بغیر نام سائل) شائع کر دیا گیا'
            : 'Fatwa published to Public Portal (questioner identity anonymized)'
          : lang === 'ur'
            ? 'فتویٰ پبلک پورٹل سے ہٹا کر اندرونی آرکائیو میں رکھا گیا'
            : 'Kept internal archive only'
      );
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await apiFetch('/api/uploads', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      }, user);
      await apiFetch(
        '/api/documents',
        {
          method: 'POST',
          body: JSON.stringify({
            entity_type: 'fatwa_question',
            entity_id: fatwaId,
            title: file.name,
            category: 'fatwa_attachment',
            file_name: uploaded.fileName,
            file_url: uploaded.fileUrl,
            mime_type: uploaded.mimeType,
            file_size_bytes: uploaded.size,
          }),
        },
        user
      );
      notify('success', lang === 'ur' ? 'فائل منسلک کر دی گئی' : 'Attachment uploaded');
      await loadWorkspace();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleExportPdfSummary = () => {
    if (!data?.question) return;
    const q = data.question;
    exportToPdf(
      `fatwa-${q.issued_fatwa_number || q.fatwa_code}`,
      `Official Fatwa Record: ${q.issued_fatwa_number || q.fatwa_code}`,
      `Category: ${q.category_name_en} | Date: ${q.issued_at || q.question_date} | Status: ${q.workflow_status}`,
      ['Field', 'Details'],
      [
        ['Fatwa Register Code', q.fatwa_code],
        ['Issued Fatwa Number', q.issued_fatwa_number || 'Pending Issuance'],
        ['Subject', q.subject_title],
        ['Category', q.category_name_en],
        ['Workflow Status', q.workflow_status],
        ['Publication Status', q.publication_status],
        ['Classical References Count', String((data.references || []).length)],
        ...(data.references || []).map((r: any, i: number) => [
          `Reference ${i + 1}`,
          `${r.book_name}${r.volume ? ` (Vol. ${r.volume}` : ''}${r.page_number ? `, p. ${r.page_number})` : r.volume ? ')' : ''}`,
        ]),
      ]
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
        <div className="h-96 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 text-center space-y-3">
        <p className="text-sm text-red-700">{error || t('errorLoad')}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2 text-xs font-medium text-white"
        >
          <span>{lang === 'ur' ? 'واپس جائیں' : 'Go Back'}</span>
        </button>
      </div>
    );
  }

  const q = data.question;
  const activeStepIdx = WORKFLOW_STEPS.indexOf(q.workflow_status);
  const seniorApproved = (data.reviews || []).some((r: any) => r.decision === 'approved_for_final');
  const isIssued = q.workflow_status === 'issued';

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    { id: 'question', label: t('tabQuestionAssign'), icon: <Users className="h-4 w-4 shrink-0" /> },
    { id: 'research', label: t('tabResearchRefs'), icon: <BookOpen className="h-4 w-4 shrink-0" /> },
    { id: 'draft', label: t('tabDraftEditor'), icon: <Edit3 className="h-4 w-4 shrink-0" /> },
    { id: 'review', label: t('tabSeniorFinal'), icon: <ShieldCheck className="h-4 w-4 shrink-0" /> },
    { id: 'document', label: t('tabIssuedPdf'), icon: <FileCheck2 className="h-4 w-4 shrink-0" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Top Bar + Workflow Stepper */}
      <div className="no-print rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-md border border-[#D9E2EC] p-2 text-[#0B2545] hover:bg-[#F4F7FA] shrink-0"
              aria-label="Back to questions list"
            >
              {lang === 'ur' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#486581]">
                <span className="font-mono-code font-semibold text-[#0B2545]">{q.fatwa_code}</span>
                {q.issued_fatwa_number && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-code font-semibold text-[#057A4B]">{q.issued_fatwa_number}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{pick(q.category_name_en, q.category_name_ur)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-code">{q.question_date}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-[#0F1F38] leading-relaxed">
                {pick(q.subject_title, q.subject_title_ur)}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <StatusText status={q.workflow_status} />
            <span className="text-[#CBD5E1]" aria-hidden="true">|</span>
            <StatusText status={q.publication_status} />
          </div>
        </div>

        {/* 8-Step Institutional Pipeline Stepper */}
        <div className="pt-2 border-t border-[#EDF2F7] overflow-x-auto">
          <div className="flex items-center justify-between min-w-[680px] gap-1">
            {WORKFLOW_STEPS.map((step, idx) => {
              const done = activeStepIdx > idx || (step === 'issued' && isIssued);
              const current = activeStepIdx === idx && !done;
              return (
                <div key={step} className="flex-1 flex flex-col items-center text-center">
                  <div className="w-full flex items-center">
                    <div className={`h-0.5 flex-1 ${idx === 0 ? 'bg-transparent' : done || current ? 'bg-[#057A4B]' : 'bg-[#D9E2EC]'}`} />
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-mono-code font-semibold border ${
                        done
                          ? 'bg-[#057A4B] border-[#057A4B] text-white'
                          : current
                            ? 'bg-[#0284C7] border-[#0284C7] text-white'
                            : 'bg-white border-[#D9E2EC] text-[#627D98]'
                      }`}
                    >
                      {done ? '✓' : idx + 1}
                    </div>
                    <div className={`h-0.5 flex-1 ${idx === WORKFLOW_STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-[#057A4B]' : 'bg-[#D9E2EC]'}`} />
                  </div>
                  <div className={`mt-1.5 text-[11px] ${current ? 'font-semibold text-[#0284C7]' : done ? 'font-medium text-[#057A4B]' : 'text-[#627D98]'}`}>
                    {t(step as any)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EDF2F7]">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0B2545] text-white'
                    : 'bg-[#F4F7FA] text-[#243B53] hover:bg-[#E2E8F0]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          className={`no-print rounded-md border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-[#057A4B]/30 bg-[#057A4B]/5 text-[#057A4B]'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* TAB 1: QUESTION & ASSIGNMENTS */}
      {activeTab === 'question' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#EDF2F7] pb-3">
                <h3 className="text-sm font-semibold text-[#0B2545]">{t('questionLabel')}</h3>
                <span className="text-xs text-[#486581]">
                  {t('questionSource')}: <span className="font-medium text-[#0B2545]">{q.source}</span>
                </span>
              </div>
              <div className="rounded-md bg-[#F4F7FA] border border-[#D9E2EC] p-4 text-sm text-[#0F1F38] whitespace-pre-wrap leading-loose">
                {q.question_text}
              </div>

              {/* Privacy-Aware Questioner Details */}
              <div className="border-t border-[#EDF2F7] pt-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0B2545] mb-3">
                  <Lock className="h-3.5 w-3.5 text-[#0284C7]" />
                  <span>{lang === 'ur' ? 'سائل کی معلومات (رازداری کے تحت)' : 'Questioner Metadata (Privacy-Protected)'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded border border-[#EDF2F7] p-3">
                    <div className="text-[#627D98]">{t('questionerName')}</div>
                    <div className="mt-1 font-medium text-[#0F1F38]">{q.questioner_name}</div>
                  </div>
                  <div className="rounded border border-[#EDF2F7] p-3">
                    <div className="text-[#627D98]">{t('cityCountry')}</div>
                    <div className="mt-1 font-medium text-[#0F1F38]">
                      {[q.city, q.country].filter(Boolean).join(', ') || '—'}
                    </div>
                  </div>
                  <div className="rounded border border-[#EDF2F7] p-3">
                    <div className="text-[#627D98]">{t('phone')} / {t('email')}</div>
                    <div className="mt-1 font-mono-code text-[#0F1F38]">
                      {canViewQuestionerPrivacy || !q.is_identity_private
                        ? [q.questioner_phone, q.questioner_email].filter(Boolean).join(' · ') || '—'
                        : lang === 'ur'
                          ? 'رازداری کے سبب پوشیدہ'
                          : 'Hidden by Privacy Rule'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#0B2545]">
                  {lang === 'ur' ? 'منسلک دستاویزات / اسکین نقول' : 'Question Attachments'}
                </h3>
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] px-3 py-1.5 text-xs font-medium text-[#0B2545] hover:bg-[#E2E8F0]">
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('uploadDocument')}</span>
                  <input type="file" onChange={handleAttachmentUpload} className="hidden" />
                </label>
              </div>
              {data.attachments.length === 0 ? (
                <div className="text-xs text-[#627D98] py-3">{t('noData')}</div>
              ) : (
                <div className="divide-y divide-[#EDF2F7]">
                  {data.attachments.map((att: any) => (
                    <div key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-[#0F1F38]">{att.title || att.file_name}</span>
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#0284C7] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{lang === 'ur' ? 'ڈاؤن لوڈ / دیکھیں' : 'View'}</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Assignments */}
          <div className="space-y-5">
            {canAssignFatwa && (
              <form onSubmit={handleAssign} className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0B2545]">
                  <UserPlus className="h-4 w-4 text-[#057A4B]" />
                  <span>{t('assignResearcher')}</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">
                    {lang === 'ur' ? 'مفتی / محقق / طالبِ علم منتخب کریں' : 'Select Researcher / Mufti / Student'}
                  </label>
                  <select
                    required
                    value={assignForm.assignee_profile_id}
                    onChange={(e) => setAssignForm((f) => ({ ...f, assignee_profile_id: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  >
                    <option value="">{lang === 'ur' ? 'منتخب کریں...' : 'Select person...'}</option>
                    {lookups.assignees.map((a) => (
                      <option key={a.profile_id} value={a.profile_id}>
                        {pick(a.full_name, a.full_name_ur)} ({pick(a.role_title_en, a.role_title_ur)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'ذمہ داری' : 'Role'}
                    </label>
                    <select
                      value={assignForm.assignee_role}
                      onChange={(e) => setAssignForm((f) => ({ ...f, assignee_role: e.target.value }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-2.5 py-2 text-xs text-[#0F1F38]"
                    >
                      <option value="research_student">{lang === 'ur' ? 'طالبِ علمِ تخصص' : 'Research Student'}</option>
                      <option value="researcher">{lang === 'ur' ? 'معاون محقق' : 'Researcher'}</option>
                      <option value="mufti">{lang === 'ur' ? 'مفتی / مجیب' : 'Mufti'}</option>
                      <option value="senior_mufti">{lang === 'ur' ? 'مفتیِ اعظم' : 'Senior Mufti'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('deadline')}</label>
                    <input
                      type="date"
                      value={assignForm.deadline}
                      onChange={(e) => setAssignForm((f) => ({ ...f, deadline: e.target.value }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-2.5 py-2 text-xs font-mono-code text-[#0F1F38]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('assignmentInstructions')}</label>
                  <textarea
                    rows={3}
                    value={assignForm.instructions}
                    onChange={(e) => setAssignForm((f) => ({ ...f, instructions: e.target.value }))}
                    placeholder={lang === 'ur' ? 'تحقیق و تخریج کے متعلق ہدایات درج کریں...' : 'Instructions for research & references...'}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-md bg-[#057A4B] px-4 py-2 text-xs font-medium text-white hover:bg-[#04643D]"
                >
                  {t('assignResearcher')}
                </button>
              </form>
            )}

            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0B2545]">
                {lang === 'ur' ? 'موجودہ تفویض و تاریخچہ' : 'Assignment History'}
              </h3>
              {data.assignments.length === 0 ? (
                <div className="text-xs text-[#627D98]">{t('noData')}</div>
              ) : (
                <div className="space-y-3">
                  {data.assignments.map((asg: any) => (
                    <div key={asg.id} className="rounded-md border border-[#EDF2F7] bg-[#F4F7FA] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B2545]">{pick(asg.full_name, asg.full_name_ur)}</span>
                        <span className="text-[11px] text-[#057A4B] font-medium">{asg.assignee_role}</span>
                      </div>
                      <div className="text-[11px] text-[#486581] font-mono-code">
                        {lang === 'ur' ? `تاریخ: ${asg.assigned_date}` : `Assigned: ${asg.assigned_date}`}
                        {asg.deadline ? ` · ${t('deadline')}: ${asg.deadline}` : ''}
                      </div>
                      {asg.instructions && <p className="text-[#243B53] pt-1">{asg.instructions}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESEARCH WORKSPACE & REUSABLE REFERENCES */}
      {activeTab === 'research' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Structured Research Workspace */}
          <div className="space-y-5">
            <form onSubmit={handleAddResearch} className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0B2545]">{t('addResearchNote')}</h3>
              <div>
                <label className="block text-[11px] font-medium text-[#486581] mb-1">
                  {lang === 'ur' ? 'تحقیقی خلاصہ و بنیادی نکات *' : 'Research Notes *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={researchForm.research_notes}
                  onChange={(e) => setResearchForm((f) => ({ ...f, research_notes: e.target.value }))}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('relatedBooks')}</label>
                  <input
                    type="text"
                    value={researchForm.related_books}
                    onChange={(e) => setResearchForm((f) => ({ ...f, related_books: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('fiqhiOpinions')}</label>
                  <input
                    type="text"
                    value={researchForm.fiqhi_opinions}
                    onChange={(e) => setResearchForm((f) => ({ ...f, fiqhi_opinions: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('arabicQuotations')}</label>
                <textarea
                  rows={3}
                  dir="rtl"
                  value={researchForm.arabic_quotations}
                  onChange={(e) => setResearchForm((f) => ({ ...f, arabic_quotations: e.target.value }))}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm font-arabic text-[#0F1F38]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('urduExplanation')}</label>
                  <textarea
                    rows={2}
                    value={researchForm.urdu_explanation}
                    onChange={(e) => setResearchForm((f) => ({ ...f, urdu_explanation: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('supportingEvidence')}</label>
                  <textarea
                    rows={2}
                    value={researchForm.supporting_evidence}
                    onChange={(e) => setResearchForm((f) => ({ ...f, supporting_evidence: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-md bg-[#0B2545] px-4 py-2 text-xs font-medium text-white hover:bg-[#103563]"
              >
                {t('save')}
              </button>
            </form>

            {/* Saved Research Timeline */}
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0B2545]">
                {lang === 'ur' ? 'محفوظ شدہ تحقیقی نکات' : 'Recorded Research Entries'} ({data.research.length})
              </h3>
              {data.research.length === 0 ? (
                <div className="text-xs text-[#627D98]">{t('noData')}</div>
              ) : (
                <div className="space-y-4">
                  {data.research.map((r: any) => (
                    <div key={r.id} className="rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[#486581]">
                        <span className="font-semibold text-[#0B2545]">{r.author_name}</span>
                        <span className="font-mono-code text-[11px]">{(r.created_at || '').slice(0, 10)}</span>
                      </div>
                      <p className="text-[#0F1F38] whitespace-pre-wrap">{r.research_notes}</p>
                      {r.related_books && (
                        <div className="text-[#243B53]">
                          <span className="font-semibold">{t('relatedBooks')}:</span> {r.related_books}
                        </div>
                      )}
                      {r.arabic_quotations && (
                        <div dir="rtl" className="font-arabic text-sm bg-white border border-[#D9E2EC] rounded p-3 text-[#0B2545]">
                          {r.arabic_quotations}
                        </div>
                      )}
                      {r.fiqhi_opinions && (
                        <div className="text-[#243B53]">
                          <span className="font-semibold">{t('fiqhiOpinions')}:</span> {r.fiqhi_opinions}
                        </div>
                      )}
                      {r.supporting_evidence && (
                        <div className="text-[#243B53]">
                          <span className="font-semibold">{t('supportingEvidence')}:</span> {r.supporting_evidence}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Structured References & Searchable Reusable Library */}
          <div className="space-y-5">
            <form onSubmit={handleAddReference} className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0B2545]">{t('addReference')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('bookName')} *</label>
                  <input
                    required
                    type="text"
                    value={refForm.book_name}
                    onChange={(e) => setRefForm((f) => ({ ...f, book_name: e.target.value }))}
                    placeholder={lang === 'ur' ? 'رد المحتار (شامی)' : 'Radd al-Muhtar'}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('authorName')}</label>
                  <input
                    type="text"
                    value={refForm.author}
                    onChange={(e) => setRefForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('volumeNo')}</label>
                  <input
                    type="text"
                    value={refForm.volume}
                    onChange={(e) => setRefForm((f) => ({ ...f, volume: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-2.5 py-2 text-xs font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('pageNo')}</label>
                  <input
                    type="text"
                    value={refForm.page_number}
                    onChange={(e) => setRefForm((f) => ({ ...f, page_number: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-2.5 py-2 text-xs font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('chapter')}</label>
                  <input
                    type="text"
                    value={refForm.chapter}
                    onChange={(e) => setRefForm((f) => ({ ...f, chapter: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-2.5 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('arabicText')} *</label>
                <textarea
                  required
                  rows={3}
                  dir="rtl"
                  value={refForm.arabic_quotation}
                  onChange={(e) => setRefForm((f) => ({ ...f, arabic_quotation: e.target.value }))}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm font-arabic text-[#0F1F38]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('explanationNote')}</label>
                <textarea
                  rows={2}
                  value={refForm.explanation}
                  onChange={(e) => setRefForm((f) => ({ ...f, explanation: e.target.value }))}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-[#057A4B] px-4 py-2 text-xs font-medium text-white hover:bg-[#04643D]"
              >
                {t('addReference')}
              </button>
            </form>

            {/* Attached References to this Question */}
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0B2545]">
                {t('referencesLabel')} ({data.references.length})
              </h3>
              {data.references.length === 0 ? (
                <div className="text-xs text-[#627D98]">{t('noData')}</div>
              ) : (
                <div className="space-y-3">
                  {data.references.map((refItem: any, idx: number) => (
                    <div key={refItem.id} className="rounded-md border border-[#D9E2EC] p-3.5 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-[#0B2545]">
                          {idx + 1}. {refItem.book_name}
                          {refItem.author ? ` — ${refItem.author}` : ''}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReference(refItem.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          aria-label="Delete reference"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-[#486581] font-mono-code">
                        {[refItem.chapter, refItem.volume && `${t('volumeNo')}: ${refItem.volume}`, refItem.page_number && `${t('pageNo')}: ${refItem.page_number}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div dir="rtl" className="font-arabic text-sm bg-[#F4F7FA] rounded p-2.5 text-[#0F1F38]">
                        {refItem.arabic_quotation}
                      </div>
                      {refItem.explanation && <p className="text-[#243B53]">{refItem.explanation}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reusable Classical References Search */}
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0B2545]">{t('searchReusableRefs')}</h3>
              <div className="relative">
                <Search className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={reusableQuery}
                  onChange={(e) => setReusableQuery(e.target.value)}
                  placeholder={t('searchReusableRefs')}
                  className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs ${
                    lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-[#EDF2F7]">
                {reusableRefs.map((rr) => (
                  <div key={rr.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0B2545]">{rr.book_name} ({rr.volume || '—'}/{rr.page_number || '—'})</div>
                      <div dir="rtl" className="font-arabic text-[#486581] mt-0.5">
                        {rr.arabic_quotation && rr.arabic_quotation.length > 180
                          ? `${rr.arabic_quotation.slice(0, 180)}...`
                          : rr.arabic_quotation}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReuseReference(rr)}
                      className="shrink-0 rounded border border-[#057A4B] px-2.5 py-1 text-[11px] font-medium text-[#057A4B] hover:bg-[#057A4B] hover:text-white transition-colors whitespace-nowrap"
                    >
                      {lang === 'ur' ? 'شامل کریں' : 'Reuse'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: URDU & ARABIC DRAFT EDITOR + AUTOSAVE + VERSION HISTORY */}
      {activeTab === 'draft' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF2F7] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0B2545]">{t('tabDraftEditor')}</h3>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#486581]">
                  <Clock className="h-3.5 w-3.5 text-[#0284C7]" />
                  <span>
                    {autosaveState === 'saving'
                      ? lang === 'ur'
                        ? 'خودکار محفوظ ہو رہا ہے...'
                        : 'Autosaving...'
                      : autosaveState === 'error'
                        ? lang === 'ur'
                          ? 'محفوظ کرنے میں خرابی'
                          : 'Autosave error'
                        : lastSavedAt
                          ? `${t('autosavedAt')}: ${lastSavedAt.replace('T', ' ').slice(0, 19)}`
                          : lang === 'ur'
                            ? 'خودکار محفوظی فعال ہے'
                            : 'Autosave active'}
                  </span>
                </div>
              </div>

              <div className="text-xs font-mono-code text-[#057A4B]">
                {lang === 'ur'
                  ? `موجودہ ورژن: v${data.draft?.current_version || 1}`
                  : `Current Version: v${data.draft?.current_version || 1}`}
              </div>
            </div>

            {isIssued && (
              <div className="rounded-md border border-[#0284C7]/40 bg-[#0284C7]/5 px-4 py-2.5 text-xs text-[#0B2545]">
                {lang === 'ur'
                  ? 'یہ فتویٰ جاری ہو چکا ہے؛ جاری شدہ فتویٰ کا متن براہِ راست تبدیل نہیں کیا جا سکتا۔'
                  : 'This Fatwa has already been issued. Its approved text is locked in archive.'}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('questionSubject')}</label>
              <input
                type="text"
                disabled={isIssued}
                value={draftTitle}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setDraftTitle(e.target.value);
                }}
                className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm font-semibold text-[#0F1F38]"
              />
            </div>

            {/* Formatting & Reference Toolbar */}
            {!isIssued && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-2">
                <button
                  type="button"
                  onClick={() => insertAtCursor('\n\n### شرعی حکم:\n')}
                  className="inline-flex items-center gap-1 rounded bg-white border border-[#D9E2EC] px-2.5 py-1 text-xs text-[#0B2545] hover:bg-[#E2E8F0]"
                >
                  <Type className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'سرخی' : 'Heading'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor('\n• ')}
                  className="inline-flex items-center gap-1 rounded bg-white border border-[#D9E2EC] px-2.5 py-1 text-xs text-[#0B2545] hover:bg-[#E2E8F0]"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'فہرست' : 'Bullet List'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor('\n\nواللہ تعالیٰ اعلم بالصواب')}
                  className="inline-flex items-center gap-1 rounded bg-white border border-[#D9E2EC] px-2.5 py-1 text-xs text-[#057A4B] hover:bg-[#E2E8F0]"
                >
                  <span>{lang === 'ur' ? 'اختتامی کلمہ' : 'Closing Formula'}</span>
                </button>
                {data.references.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const refItem = data.references.find((r: any) => r.id === e.target.value);
                      if (refItem) {
                        insertAtCursor(
                          `\n\n[${refItem.book_name}${refItem.volume ? ` ج ${refItem.volume}` : ''}${refItem.page_number ? ` ص ${refItem.page_number}` : ''}]\n${refItem.arabic_quotation}\n`
                        );
                      }
                      e.target.value = '';
                    }}
                    className="rounded border border-[#D9E2EC] bg-white px-2.5 py-1 text-xs text-[#0B2545]"
                  >
                    <option value="">{lang === 'ur' ? '+ محفوظ حوالہ متن میں شامل کریں' : '+ Insert Reference Citation'}</option>
                    {data.references.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.book_name} ({r.volume || '—'}/{r.page_number || '—'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[#486581] mb-1">
                {lang === 'ur' ? 'مسودۂ جواب (اردو RTL)' : 'Draft Answer (Urdu RTL)'}
              </label>
              <textarea
                ref={urduEditorRef}
                rows={12}
                dir="rtl"
                disabled={isIssued}
                value={draftUr}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setDraftUr(e.target.value);
                }}
                placeholder="بسم اللہ الرحمن الرحیم — الجواب وباللہ التوفیق..."
                className="w-full rounded-md border border-[#D9E2EC] px-4 py-3 text-sm font-urdu text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#486581] mb-1">
                {lang === 'ur' ? 'عربی عبارت / دلائلِ فقہیہ (عربی RTL)' : 'Arabic Text & Fiqhi Citations (Arabic RTL)'}
              </label>
              <textarea
                rows={5}
                dir="rtl"
                disabled={isIssued}
                value={draftAr}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setDraftAr(e.target.value);
                }}
                placeholder="قال اللہ تعالیٰ / فی الدر المختار..."
                className="w-full rounded-md border border-[#D9E2EC] px-4 py-3 text-base font-arabic text-[#0B2545] focus:border-[#057A4B] focus:outline-none"
              />
            </div>

            {!isIssued && (
              <div className="pt-3 border-t border-[#EDF2F7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder={lang === 'ur' ? 'ترمیم کی مختصر وضاحت (اختیاری)...' : 'Version note (optional)...'}
                  className="flex-1 rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSaveDraft({ saveVersion: true })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#0B2545] bg-white px-4 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA] whitespace-nowrap"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{t('saveVersionSnapshot')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveDraft({ submitForSeniorReview: true })}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-4 py-2 text-xs font-medium text-white hover:bg-[#04643D] whitespace-nowrap"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{t('submitToSenior')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Version History Drawer */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-3 h-fit">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0B2545]">
              <History className="h-4 w-4 text-[#0284C7]" />
              <span>{t('versionHistory')}</span>
            </div>
            {data.versions.length === 0 ? (
              <div className="text-xs text-[#627D98]">{t('noData')}</div>
            ) : (
              <div className="space-y-3 max-h-[540px] overflow-y-auto">
                {data.versions.map((ver: any) => (
                  <div key={ver.id} className="rounded-md border border-[#EDF2F7] bg-[#F4F7FA] p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-code font-bold text-[#0B2545]">v{ver.version_number}</span>
                      <span className="font-mono-code text-[11px] text-[#627D98]">{(ver.created_at || '').slice(0, 16)}</span>
                    </div>
                    <div className="text-[#243B53] font-medium">{ver.saved_by_name}</div>
                    {ver.change_summary && <div className="text-[#486581]">{ver.change_summary}</div>}
                    {!isIssued && (
                      <button
                        type="button"
                        onClick={() => handleRestoreVersion(ver)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#0284C7] hover:underline"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{lang === 'ur' ? 'ایڈیٹر میں بحال کریں' : 'Restore to Editor'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SENIOR REVIEW, NAZIM FINAL APPROVAL & PUBLICATION CONTROL */}
      {activeTab === 'review' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Senior Mufti Review */}
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#0B2545]">{t('seniorMuftiReview')}</h3>

              {canSeniorReviewFatwa && !isIssued ? (
                <form onSubmit={handleSeniorReview} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'فیصلہ' : 'Review Decision'}
                    </label>
                    <select
                      value={seniorForm.decision}
                      onChange={(e) => setSeniorForm((f) => ({ ...f, decision: e.target.value as any }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                    >
                      <option value="approved_for_final">{t('approveForFinal')}</option>
                      <option value="corrections_requested">{t('requestCorrections')}</option>
                      <option value="returned">{t('returned')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'مفتیِ اعظم کے تاثرات / ہدایات *' : 'Senior Mufti Comments *'}
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={seniorForm.comments}
                      onChange={(e) => setSeniorForm((f) => ({ ...f, comments: e.target.value }))}
                      placeholder={lang === 'ur' ? 'دلائل و عبارت کی توثیق یا اصلاحی نکات تحریر فرمائیں...' : 'Verify references and draft or request corrections...'}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-[#0284C7] px-4 py-2 text-xs font-medium text-white hover:bg-[#0369A1]"
                  >
                    {lang === 'ur' ? 'جائزہ محفوظ کریں' : 'Submit Senior Review'}
                  </button>
                </form>
              ) : (
                <div className="rounded border border-[#EDF2F7] bg-[#F4F7FA] p-3 text-xs text-[#486581]">
                  {isIssued
                    ? lang === 'ur'
                      ? 'یہ فتویٰ حتمی منظوری کے بعد جاری ہو چکا ہے۔'
                      : 'This Fatwa has already completed review and been issued.'
                    : lang === 'ur'
                      ? 'صرف مفتیِ اعظم یا ناظمِ دارالافتاء اس حصے میں فیصلہ درج کر سکتے ہیں۔'
                      : 'Only Senior Mufti or Nazim Dar-ul-Ifta may submit Senior Review decisions.'}
                </div>
              )}

              <div className="border-t border-[#EDF2F7] pt-3 space-y-2.5">
                <div className="text-xs font-semibold text-[#486581]">
                  {lang === 'ur' ? 'جائزوں کی تاریخ' : 'Senior Review History'}
                </div>
                {data.reviews.length === 0 ? (
                  <div className="text-xs text-[#627D98]">{t('noData')}</div>
                ) : (
                  data.reviews.map((rev: any) => (
                    <div key={rev.id} className="rounded border border-[#EDF2F7] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B2545]">{rev.reviewer_name}</span>
                        <StatusText status={rev.decision} />
                      </div>
                      <p className="text-[#243B53]">{rev.comments}</p>
                      <div className="text-[11px] text-[#627D98] font-mono-code">
                        v{rev.version_number} · {(rev.reviewed_at || '').slice(0, 16)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Nazim Dar-ul-Ifta Final Approval & Issuance */}
            <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#0B2545]">{t('nazimFinalApproval')}</h3>

              {!seniorApproved && !isIssued && (
                <div className="rounded-md border border-[#B45309]/40 bg-[#B45309]/5 p-3 text-xs text-[#B45309]">
                  {lang === 'ur'
                    ? 'ضابطے کے مطابق حتمی منظوری اور اجراءِ فتویٰ سے پہلے مفتیِ اعظم / سینئر مفتی کی توثیق لازمی ہے۔'
                    : 'Workflow Gate: Senior Mufti approval is mandatory before Nazim Final Approval and Issuance.'}
                </div>
              )}

              {isIssued && (
                <div className="rounded-md border border-[#057A4B]/40 bg-[#057A4B]/5 p-4 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-[#057A4B]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{lang === 'ur' ? 'فتویٰ باضابطہ جاری کر دیا گیا ہے' : 'Fatwa Officially Issued'}</span>
                  </div>
                  <div className="font-mono-code text-[#0B2545] font-bold">
                    {t('issuedFatwaNo')}: {q.issued_fatwa_number} · {q.issued_at}
                  </div>
                </div>
              )}

              {canFinalApproveFatwa && !isIssued ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'ناظمِ دارالافتاء کا منظوری نوٹ' : 'Nazim Approval Note'}
                    </label>
                    <textarea
                      rows={3}
                      value={finalComments}
                      onChange={(e) => setFinalComments(e.target.value)}
                      placeholder={lang === 'ur' ? 'حتمی اجراء یا واپسی کے متعلق نوٹ تحریر کریں...' : 'Approval notes or reason for returning...'}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!seniorApproved && q.workflow_status !== 'final_approval'}
                      onClick={() => handleFinalApproval('issued')}
                      className="rounded-md bg-[#057A4B] px-4 py-2 text-xs font-medium text-white hover:bg-[#04643D] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {t('approveAndIssueFatwa')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinalApproval('returned_to_review')}
                      className="rounded-md border border-[#B45309] bg-white px-4 py-2 text-xs font-medium text-[#B45309] hover:bg-[#B45309]/5 whitespace-nowrap"
                    >
                      {lang === 'ur' ? 'دوبارہ جائزے کے لیے واپس کریں' : 'Return to Review'}
                    </button>
                  </div>
                </div>
              ) : !isIssued ? (
                <div className="rounded border border-[#EDF2F7] bg-[#F4F7FA] p-3 text-xs text-[#486581]">
                  {lang === 'ur'
                    ? 'حتمی منظوری اور فتویٰ نمبر جاری کرنے کا اختیار صرف ناظمِ دارالافتاء (ایڈمن) کو ہے۔'
                    : 'Only Nazim Dar-ul-Ifta (Admin) can grant Final Approval and generate an Official Fatwa Number.'}
                </div>
              ) : null}

              <div className="border-t border-[#EDF2F7] pt-3 space-y-2.5">
                <div className="text-xs font-semibold text-[#486581]">
                  {lang === 'ur' ? 'منظوری و اجراء کا ریکارڈ' : 'Approval Log'}
                </div>
                {data.approvals.length === 0 ? (
                  <div className="text-xs text-[#627D98]">{t('noData')}</div>
                ) : (
                  data.approvals.map((app: any) => (
                    <div key={app.id} className="rounded border border-[#EDF2F7] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B2545]">{app.approver_name}</span>
                        <StatusText status={app.decision} />
                      </div>
                      <p className="text-[#243B53]">{app.comments}</p>
                      <div className="text-[11px] font-mono-code text-[#627D98]">
                        {app.issued_fatwa_number || ''} · {(app.approved_at || '').slice(0, 16)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Optional Public Portal Publication Control */}
          <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF2F7] pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#0284C7]" />
                <h3 className="text-sm font-semibold text-[#0B2545]">{t('publicationControl')}</h3>
              </div>
              <StatusText status={q.publication_status} />
            </div>

            <div className="rounded-md bg-[#F4F7FA] border border-[#D9E2EC] p-3 text-xs text-[#243B53]">
              {lang === 'ur'
                ? 'اہم: کوئی بھی فتویٰ خودکار طور پر پبلک نہیں ہوتا۔ ناظمِ دارالافتاء کی صریح اجازت کے بعد ہی اشاعت ہوتی ہے، اور سائل کا نام، فون یا ای میل پبلک پورٹل پر کبھی ظاہر نہیں کیا جاتا۔'
                : 'Privacy Policy: Fatwas are never auto-published. Explicit Nazim authorization is required after issuance, and private questioner identity/contact fields are strictly omitted from public snapshots.'}
            </div>

            {canControlPublication ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'عوامی عنوان (اردو)' : 'Public Title (Urdu)'}
                    </label>
                    <input
                      type="text"
                      value={pubForm.public_title_ur}
                      onChange={(e) => setPubForm((f) => ({ ...f, public_title_ur: e.target.value }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'عوامی عنوان (انگریزی)' : 'Public Title (English)'}
                    </label>
                    <input
                      type="text"
                      value={pubForm.public_title_en}
                      onChange={(e) => setPubForm((f) => ({ ...f, public_title_en: e.target.value }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'ترمیم شدہ عوامی سوال (بغیر نام)' : 'Sanitized Public Question'}
                    </label>
                    <textarea
                      rows={4}
                      value={pubForm.public_question_text}
                      onChange={(e) => setPubForm((f) => ({ ...f, public_question_text: e.target.value }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#486581] mb-1">
                      {lang === 'ur' ? 'عوامی جواب' : 'Public Answer Text'}
                    </label>
                    <textarea
                      rows={4}
                      value={pubForm.public_answer_text}
                      onChange={(e) => setPubForm((f) => ({ ...f, public_answer_text: e.target.value }))}
                      className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={!isIssued}
                    onClick={() => handlePublicationSave(true)}
                    className="rounded-md bg-[#0284C7] px-4 py-2 text-xs font-medium text-white hover:bg-[#0369A1] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {t('publishToPortal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePublicationSave(false)}
                    className="rounded-md border border-[#D9E2EC] bg-white px-4 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA] whitespace-nowrap"
                  >
                    {t('keepInternalOnly')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#486581]">
                {lang === 'ur'
                  ? 'اشاعت کا اختیار صرف ناظمِ دارالافتاء کے پاس ہے۔'
                  : 'Publication controls are restricted to Nazim Dar-ul-Ifta.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ISSUED FATWA OFFICIAL INSTITUTIONAL DOCUMENT & PRINT / PDF */}
      {activeTab === 'document' && (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D9E2EC] bg-white px-5 py-3.5">
            <div className="text-xs text-[#486581]">
              {lang === 'ur'
                ? 'سرکاری فتویٰ دستاویز پرنٹ کریں یا PDF میں محفوظ کریں۔'
                : 'Print the complete Urdu/Arabic institutional Fatwa or download a structured PDF summary.'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-4 py-2 text-xs font-medium text-white hover:bg-[#103563] whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{t('printCard')} / PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdfSummary}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#057A4B] bg-white px-4 py-2 text-xs font-medium text-[#057A4B] hover:bg-[#057A4B]/5 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t('exportPdf')}</span>
              </button>
            </div>
          </div>

          <div className="print-container rounded-lg border-2 border-[#0B2545] bg-white p-8 md:p-10 space-y-6">
            {/* Official Letterhead */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-[#057A4B] pb-5">
              <div className="flex items-center gap-4">
                <img
                  src="/assets/aistudio/naafay_logo_8857642c.jpg"
                  alt="Naafay Darul Ifta Seal"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-full border border-[#D9E2EC] object-contain p-0.5 bg-white shrink-0"
                />
                <div>
                  <h2 className="text-xl font-bold text-[#0B2545]">{t('fatwaDocumentTitle')}</h2>
                  <p className="text-xs text-[#057A4B] font-medium">
                    {lang === 'ur'
                      ? 'شعبۂ تحقیق و افتاء — دارالافتاء نافع و تخصص فی الفقہ'
                      : 'Department of Shariah Research & Fatwa Issuance'}
                  </p>
                </div>
              </div>

              <div className="text-xs space-y-1 text-end">
                <div>
                  <span className="text-[#486581]">{t('issuedFatwaNo')}: </span>
                  <span className="font-mono-code font-bold text-[#057A4B]">
                    {q.issued_fatwa_number || q.fatwa_code}
                  </span>
                </div>
                <div>
                  <span className="text-[#486581]">{t('issuanceDateLabel')}: </span>
                  <span className="font-mono-code text-[#0B2545]">{q.issued_at || q.question_date}</span>
                </div>
                <div>
                  <span className="text-[#486581]">{t('fatwaCategory')}: </span>
                  <span className="text-[#0B2545] font-medium">{pick(q.category_name_en, q.category_name_ur)}</span>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="text-center border-b border-[#EDF2F7] pb-3">
              <div className="text-xs text-[#486581]">{lang === 'ur' ? 'موضوعِ استفتاء' : 'Subject'}</div>
              <h3 className="mt-1 text-lg font-bold text-[#0B2545]">{pick(q.subject_title, q.subject_title_ur)}</h3>
            </div>

            {/* Question */}
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#0284C7]">{t('questionLabel')}</div>
              <div className="rounded-md bg-[#F4F7FA] border border-[#D9E2EC] p-4 text-sm text-[#0F1F38] whitespace-pre-wrap leading-loose">
                {q.question_text}
              </div>
            </div>

            {/* Answer */}
            <div className="space-y-3">
              <div className="text-sm font-bold text-[#057A4B]">{t('answerLabel')}</div>
              <div dir="rtl" className="font-urdu text-base text-[#0F1F38] whitespace-pre-wrap leading-[2.3]">
                {draftUr || (lang === 'ur' ? 'مسودۂ جواب ابھی تحریر نہیں کیا گیا۔' : 'Answer draft has not been written yet.')}
              </div>
              {draftAr && (
                <div dir="rtl" className="font-arabic text-base bg-[#F4F7FA] border border-[#D9E2EC] rounded-md p-4 text-[#0B2545] whitespace-pre-wrap">
                  {draftAr}
                </div>
              )}
            </div>

            {/* Classical References */}
            {data.references.length > 0 && (
              <div className="border-t border-[#D9E2EC] pt-4 space-y-2">
                <div className="text-xs font-bold text-[#0B2545]">{t('referencesLabel')}</div>
                <ol className="space-y-2 text-xs text-[#243B53]">
                  {data.references.map((r: any, idx: number) => (
                    <li key={r.id} className="rounded bg-[#F4F7FA] p-2.5">
                      <div className="font-semibold text-[#0B2545]">
                        ({idx + 1}) {r.book_name}
                        {r.volume ? `، ج ${r.volume}` : ''}
                        {r.page_number ? `، ص ${r.page_number}` : ''}
                      </div>
                      <div dir="rtl" className="font-arabic text-sm text-[#0F1F38] mt-1">{r.arabic_quotation}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Authorized Seal */}
            <div className="border-t-2 border-[#0B2545] pt-5 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-xs">
              <div className="text-[#486581]">
                <div>{lang === 'ur' ? 'واللہ سبحانہ وتعالیٰ اعلم بالصواب' : 'Wallahu Ta’ala A’lam bis-Sawab'}</div>
                <div className="mt-1 font-mono-code">
                  {q.issued_fatwa_number ? `${t('issuedFatwaNo')}: ${q.issued_fatwa_number}` : `${t('fatwaId')}: ${q.fatwa_code} (${t('draft')})`}
                </div>
              </div>
              <div className="text-end">
                <div className="font-bold text-[#0B2545]">{t('authorizedSeal')}</div>
                <div className="text-[#057A4B] mt-0.5">
                  {data.approvals[0]?.approver_name || (lang === 'ur' ? 'مفتی وارث نصیب' : 'Mufti Waris Naseeb')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
