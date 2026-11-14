const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'naafay_academic.db');
const db = new Database(dbPath);

console.log('Opened DB at:', dbPath);

const pTeacher1 = 'prof-teacher-1';
const pTeacher2 = 'prof-teacher-2';
const t1 = 'tch-1';
const t2 = 'tch-2';
const t3 = 'tch-3';
const t4 = 'tch-4';

const cls1 = 'cls-tak1';
const cls2 = 'cls-tak2';
const cls3 = 'cls-ifta';

const ayCurr = 'ay-1447';

const today = new Date().toISOString().slice(0, 10);
const d = new Date();
d.setDate(d.getDate() - 1);
const yesterday = d.toISOString().slice(0, 10);
d.setDate(d.getDate() - 1);
const twoDaysAgo = d.toISOString().slice(0, 10);

function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

// 1. Seed Study Logs for stu-4, stu-5, stu-6, stu-7, stu-8
const insStudy = db.prepare('INSERT OR IGNORE INTO study_logs (id, student_id, study_date, book_id, chapter, start_position, end_position, study_details, student_comments, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insRev = db.prepare('INSERT OR IGNORE INTO study_reviews (id, study_log_id, teacher_id, reviewer_profile_id, reviewer_name, decision, comments) VALUES (?, ?, ?, ?, ?, ?, ?)');

const logs = [
  { id: 'sl-4a', stu: 'stu-4', dt: today, bk: 'bk-radd', ch: 'کتاب الصلوۃ — باب شروط الصلوۃ', sPos: 'جلد ۱، ص ۳۲۰', ePos: 'جلد ۱، ص ۳۳۵', det: 'استقبالِ قبلہ اور شرائطِ تحریمہ کے فقہی جزئیات کا مطالعہ۔', com: 'شرائط کے سقوط کی صورتیں نوٹ کی ہیں۔', st: 'approved', revBy: t1, revProf: pTeacher1, revName: 'مفتی سلمان منصورپوری', revCom: 'ماشاءاللہ، جزئیات کی تطبیق درست ہے۔' },
  { id: 'sl-5a', stu: 'stu-5', dt: today, bk: 'bk-buhuth', ch: 'فصل فی التورق والبیع بالتقسیط', sPos: 'ص ۱۱۰', ePos: 'ص ۱۲۸', det: 'معاصر مالیاتی اداروں میں تورقِ منظّم کے شرعی احکام اور مجمع الفقہ الاسلامی کی قراردادوں کا جائزہ۔', com: 'عقدِ معلق اور شرطِ فاسد پر بحث کی ہے۔', st: 'approved', revBy: t2, revProf: pTeacher2, revName: 'مفتی خالد سیف اللہ', revCom: 'عمدہ تحقیق۔ تفصیلی خلاصہ مقالہ میں شامل کریں۔' },
  { id: 'sl-5b', stu: 'stu-5', dt: yesterday, bk: 'bk-hidayah', ch: 'کتاب البیوع — باب الخیارات', sPos: 'جلد ۳، ص ۴۵', ePos: 'جلد ۳، ص ۶۰', det: 'خیارِ شرط اور خیارِ عیب کے احکام مع ادلہ فقہیہ۔', com: 'خیارِ رویت کے مسائل کا مطالعہ جاری ہے۔', st: 'approved', revBy: t2, revProf: pTeacher2, revName: 'مفتی خالد سیف اللہ', revCom: 'درست ہے۔' },
  { id: 'sl-6a', stu: 'stu-6', dt: today, bk: 'bk-siraji', ch: 'باب احوال الاخوات لاب وام ولاب', sPos: 'ص ۳۵', ePos: 'ص ۴۸', det: 'سگی اور علاتی بہنوں کے استحقاقِ میراث کی شرائط اور حجبِ حرمان کا تقابلی جائزہ۔', com: 'عملی جدول تیار کیا ہے۔', st: 'approved', revBy: t4, revProf: null, revName: 'مفتی سعید احمد پالنپوری', revCom: 'بہت خوب، جدول درست ہے۔' },
  { id: 'sl-7a', stu: 'stu-7', dt: today, bk: 'bk-rasm', ch: 'تحقیق حکم الافتاء فی النوازل', sPos: 'ص ۸۵', ePos: 'ص ۹۹', det: 'جدید مسائل میں علماءِ معاصرین کے مناہجِ افتاء کا تقابلی مطالعہ اور تمرین۔', com: 'فتاویٰ عثمانی سے مراجعت کی۔', st: 'approved', revBy: t1, revProf: pTeacher1, revName: 'مفتی سلمان منصورپوری', revCom: 'طریقہ کار مستحسن ہے۔' },
  { id: 'sl-8a', stu: 'stu-8', dt: yesterday, bk: 'bk-buhuth', ch: 'احکام الصکوک والاوراق المالیہ', sPos: 'ص ۲۴۰', ePos: 'ص ۲۵۸', det: 'اسلامی تمسکات (صکوک) کی اقسام اور ان میں ملکیتِ شائعہ کے اصول۔', com: 'صکوکِ اجارہ کے شرائط کا جائزہ۔', st: 'approved', revBy: t2, revProf: pTeacher2, revName: 'مفتی خالد سیف اللہ', revCom: 'اچھی کوشش ہے۔' }
];

logs.forEach(l => {
  insStudy.run(l.id, l.stu, l.dt, l.bk, l.ch, l.sPos, l.ePos, l.det, l.com, l.st);
  insRev.run('rev-' + l.id, l.id, l.revBy, l.revProf, l.revName, 'approved', l.revCom);
});

// 2. Seed Exams for cls2 and cls3
const exTak2 = 'exm-tak2-term';
const exIfta = 'exm-ifta-term';

db.prepare('INSERT OR IGNORE INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
  exTak2, ayCurr, cls2, 'First Term Examination — Year 2', 'ششماہی امتحانِ تخصص سالِ دوم ۱۴۴۷ھ', 'term', twoDaysAgo, yesterday, 'published'
);
db.prepare('INSERT OR IGNORE INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
  exIfta, ayCurr, cls3, 'First Term Fellowship Evaluation', 'ششماہی جائزہ تمرینِ افتاء ۱۴۴۷ھ', 'term', twoDaysAgo, yesterday, 'published'
);

const esTak2_1 = 'es-tak2-1';
const esTak2_2 = 'es-tak2-2';
const esIfta_1 = 'es-ifta-1';

const insES = db.prepare('INSERT OR IGNORE INTO exam_subjects (id, exam_id, subject_id, book_id, exam_date, written_max_marks, oral_max_marks, passing_marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
insES.run(esTak2_1, exTak2, 'sub-muamalat', 'bk-buhuth', twoDaysAgo, 80, 20, 40);
insES.run(esTak2_2, exTak2, 'sub-ahwal', 'bk-siraji', yesterday, 80, 20, 40);
insES.run(esIfta_1, exIfta, 'sub-tahqeeq', 'bk-hidayah', yesterday, 80, 20, 40);

const insER = db.prepare('INSERT OR IGNORE INTO exam_results (id, exam_id, exam_subject_id, student_id, written_marks, oral_marks, total_marks, grade, remarks, entered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

// stu-5 results
insER.run('er-stu5-1', exTak2, esTak2_1, 'stu-5', 73, 18, 91, 'A+', 'ممتاز کارکردگی', pTeacher2);
insER.run('er-stu5-2', exTak2, esTak2_2, 'stu-5', 70, 17, 87, 'A+', 'بہترین جوابات', pTeacher2);

// stu-6 results
insER.run('er-stu6-1', exTak2, esTak2_1, 'stu-6', 65, 16, 81, 'A', 'جید جداً', pTeacher2);
insER.run('er-stu6-2', exTak2, esTak2_2, 'stu-6', 68, 17, 85, 'A+', 'میراث کے مسائل میں کمال مہارت', pTeacher2);

// stu-8 results
insER.run('er-stu8-1', exTak2, esTak2_1, 'stu-8', 60, 15, 75, 'B+', 'جید کارکردگی', pTeacher2);
insER.run('er-stu8-2', exTak2, esTak2_2, 'stu-8', 62, 16, 78, 'B+', 'تسلی بخش', pTeacher2);

// stu-7 results (Ifta)
insER.run('er-stu7-1', exIfta, esIfta_1, 'stu-7', 76, 19, 95, 'A+', 'ممتاز ترین تمرین و مقالہ نگاری', pTeacher1);

// 3. Seed Research Assignments for stu-2, stu-3, stu-4, stu-6, stu-8
const insRA = db.prepare('INSERT OR IGNORE INTO research_assignments (id, topic_id, student_id, supervisor_teacher_id, deadline, status) VALUES (?, ?, ?, ?, ?, ?)');
insRA.run('ra-stu2', 'res-top-2', 'stu-2', t1, '2026-12-15', 'in_progress');
insRA.run('ra-stu3', 'res-top-1', 'stu-3', t2, '2026-12-20', 'in_progress');
insRA.run('ra-stu4', 'res-top-2', 'stu-4', t1, '2026-12-30', 'in_progress');
insRA.run('ra-stu6', 'res-top-3', 'stu-6', t2, '2026-12-10', 'submitted');
insRA.run('ra-stu8', 'res-top-1', 'stu-8', t2, '2027-01-15', 'in_progress');

// 4. Seed Lesson Records for cls2 and cls3 across yesterday and today
const insLesson = db.prepare('INSERT OR IGNORE INTO lesson_records (id, teacher_id, lesson_date, class_id, batch_id, subject_id, book_id, start_position, end_position, homework, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
insLesson.run('lr-cls1-today2', t3, today, cls1, 'bat-1a', 'sub-qawaid', 'bk-ashbah', 'القاعدۃ الثالثۃ: المشقۃ تجلب التیسیر', 'ص ۹۰ تا ص ۱۰۵', 'رخصت اور عزیمت کے چار قواعد یاد کریں', 'سبق تسلی بخش رہا');
insLesson.run('lr-cls2-yest2', t4, yesterday, cls2, 'bat-2a', 'sub-ahwal', 'bk-siraji', 'مقدمۃ المیراث و الحقوق المتعلقۃ بالترکہ', 'ص ۱ تا ص ۱۵', 'ترکہ کے متعلقہ چاروں حقوق کی ترتیب یاد کریں', 'مکمل تفہیم');
insLesson.run('lr-cls3-today', t1, today, cls3, 'bat-3a', 'sub-tahqeeq', 'bk-rasm', 'مبحث المفتی المقلد والاجتہاد الجزئی', 'ص ۵۰ تا ص ۷۰', 'مفتی مقلد کے فتاویٰ کے قواعد کا خلاصہ لکھیں', 'تمرینِ افتاء کی خصوصی مجلس');

// 5. Seed Documents for stu-3, stu-4, stu-5, stu-6, stu-7, stu-8
const insDoc = db.prepare('INSERT OR IGNORE INTO documents (id, entity_type, entity_id, title, category, file_name, file_url, mime_type, file_size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
insDoc.run('doc-stu3', 'student', 'stu-3', 'شہادۃ العالمیہ و تعلیمی اسناد', 'certificate', 'sanad_st0003.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 215000, 'prof-staff');
insDoc.run('doc-stu4', 'student', 'stu-4', 'قومی شناختی کارڈ و تعلیمی کوائف', 'identity', 'cnic_st0004.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 195000, 'prof-staff');
insDoc.run('doc-stu5', 'student', 'stu-5', 'سالِ اول کشف الدرجات و سفارشی خط', 'transcript', 'transcript_st0005.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 240000, 'prof-staff');
insDoc.run('doc-stu6', 'student', 'stu-6', 'شہادۃ العالمیہ و داخلہ فارم', 'certificate', 'sanad_st0006.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 205000, 'prof-staff');
insDoc.run('doc-stu7', 'student', 'stu-7', 'تخصص فی الفقہ سالِ اول و دوم اسناد', 'certificate', 'sanad_st0007.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 310000, 'prof-staff');
insDoc.run('doc-stu8', 'student', 'stu-8', 'طبی رخصت کی تصدیق و میڈیکل سرٹیفکیٹ', 'medical', 'medical_st0008.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 150000, 'prof-staff');

console.log('Successfully seeded database for all students ST-0001 to ST-0008!');
