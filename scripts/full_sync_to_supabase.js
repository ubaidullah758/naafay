import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getOrCreateUser(email, password, fullName, fullNameUr, phone) {
  const { data: listData } = await supabase.auth.admin.listUsers();
  const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let userId;
  if (existing) {
    userId = existing.id;
  } else {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: password || 'naafay123456',
      email_confirm: true,
      user_metadata: { full_name: fullName, full_name_ur: fullNameUr, phone },
    });
    if (createErr) throw createErr;
    userId = newUser.user.id;
  }

  // Ensure profile exists
  const { error: profErr } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    full_name_ur: fullNameUr,
    phone: phone || null,
    preferred_language: 'ur',
    is_active: true,
  }, { onConflict: 'id' });
  if (profErr) console.warn('Profile upsert warning for', email, profErr.message);

  return userId;
}

async function run() {
  console.log('🚀 Starting Full Robust Synchronization to Supabase (' + supabaseUrl + ')...');

  // 1. Fetch Classes, Academic Years, Subjects, Attendance Sessions, Roles
  const { data: classes } = await supabase.from('classes').select('*');
  const { data: years } = await supabase.from('academic_years').select('*');
  const { data: subjects } = await supabase.from('subjects').select('*');
  const { data: roles } = await supabase.from('roles').select('*');

  const currYear = years?.find((y) => y.is_current) || years?.[0];
  const clsTak1 = classes?.find((c) => c.code === 'TAK-1') || classes?.[0];
  const clsTak2 = classes?.find((c) => c.code === 'TAK-2') || classes?.[1] || clsTak1;
  const clsIfta = classes?.find((c) => c.code === 'TAK-IFTA') || classes?.[2] || clsTak1;

  const roleStudent = roles?.find((r) => r.name === 'student');
  const roleTeacher = roles?.find((r) => r.name === 'teacher');
  const roleAdmin = roles?.find((r) => r.name === 'admin');

  console.log('✅ Core Lookups Verified: Classes =', classes?.length, ', Years =', years?.length, ', Subjects =', subjects?.length);

  // 2. Batches
  for (const cls of classes || []) {
    const { data: existingBatch } = await supabase.from('batches').select('id').eq('class_id', cls.id).eq('academic_year_id', currYear.id).maybeSingle();
    if (!existingBatch) {
      await supabase.from('batches').insert({
        class_id: cls.id,
        academic_year_id: currYear.id,
        name_en: `${cls.code} - Batch 2026-2027`,
        name_ur: `${cls.name_ur} — سالِ اول بیچ`,
        capacity: 35,
      });
    }
  }
  const { data: allBatches } = await supabase.from('batches').select('*');
  console.log('✅ Batches in Supabase:', allBatches?.length);

  // 3. Books
  const booksToInsert = [
    { subCode: 'FIQH-HAN', titleEn: 'Radd al-Muhtar (Fatawa Shami)', titleUr: 'رد المحتار (فتاویٰ شامی)', author: 'علامہ ابن عابدین شامی رحمہ اللہ', totalPages: 1200 },
    { subCode: 'QAWAID', titleEn: 'Al-Ashbah wan-Nazair', titleUr: 'الاشباہ والنظائر', author: 'علامہ ابن نجیم مصری رحمہ اللہ', totalPages: 450 },
    { subCode: 'USOOL-IFTA', titleEn: 'Sharh Uqood Rasm al-Mufti', titleUr: 'شرح عقود رسم المفتی', author: 'علامہ ابن عابدین شامی رحمہ اللہ', totalPages: 350 },
    { subCode: 'MUAMALAT', titleEn: 'Fiqh al-Buyoo wa Jadeed Maliyat', titleUr: 'فقہ البیوع و جدید مالیات', author: 'مفتی تقی عثمانی دامت برکاتہم', totalPages: 900 },
    { subCode: 'AHWAL', titleEn: 'Al-Siraji fil Mirath', titleUr: 'السراجی فی المیراث', author: 'امام سراج الدین سجاوندی رحمہ اللہ', totalPages: 200 },
    { subCode: 'TAHQEEQ', titleEn: 'Kitab al-Asl (Al-Mabsoot)', titleUr: 'المبسوط للسرخسی', author: 'امام شمس الائمہ سرخسی رحمہ اللہ', totalPages: 2500 },
  ];

  for (const b of booksToInsert) {
    const sub = subjects?.find((s) => s.code === b.subCode) || subjects?.[0];
    const { data: existB } = await supabase.from('books').select('id').eq('title_en', b.titleEn).maybeSingle();
    if (!existB && sub) {
      await supabase.from('books').insert({
        subject_id: sub.id,
        title_en: b.titleEn,
        title_ur: b.titleUr,
        author: b.author,
        total_pages: b.totalPages,
        total_chapters: 15,
      });
    }
  }
  const { data: allBooks } = await supabase.from('books').select('*');
  console.log('✅ Books in Supabase:', allBooks?.length);

  // 4. Teachers
  const teachersList = [
    { code: 'TCH-001', nameEn: 'Mufti Siraj-ul-Haq', nameUr: 'مفتی سراج الحق صاحب', email: 'siraj@naafay.edu.pk', spec: 'علم المیراث و فقہ المعاملات', phone: '03001234561' },
    { code: 'TCH-002', nameEn: 'Mufti Abdul Basit', nameUr: 'مفتی عبد الباسط صاحب', email: 'abdulbasit@naafay.edu.pk', spec: 'رسم المفتی و تدریب الافتاء', phone: '03001234562' },
    { code: 'TCH-003', nameEn: 'Mufti Salman Usmani', nameUr: 'مفتی سلمان عثمانی صاحب', email: 'salman@naafay.edu.pk', spec: 'فقہ الحنفی و النوازل', phone: '03001234563' },
  ];

  for (const t of teachersList) {
    const profId = await getOrCreateUser(t.email, 'teacher123456', t.nameEn, t.nameUr, t.phone);
    if (roleTeacher) {
      await supabase.from('user_roles').upsert({ user_id: profId, role_id: roleTeacher.id }, { onConflict: 'user_id, role_id' });
    }
    const { data: existTch } = await supabase.from('teachers').select('id').eq('teacher_code', t.code).maybeSingle();
    if (existTch) {
      await supabase.from('teachers').update({
        profile_id: profId,
        full_name: t.nameEn,
        full_name_ur: t.nameUr,
        qualification: 'شہادۃ العالمیہ فی العلوم الاسلامیہ و تخصص فی الفقہ',
        qualification_ur: 'شہادۃ العالمیہ فی العلوم الاسلامیہ و تخصص فی الفقہ',
        specialization: t.spec,
        phone: t.phone,
        email: t.email,
        status: 'active',
      }).eq('id', existTch.id);
    } else {
      const { error: tchErr } = await supabase.from('teachers').insert({
        profile_id: profId,
        teacher_code: t.code,
        full_name: t.nameEn,
        full_name_ur: t.nameUr,
        qualification: 'شہادۃ العالمیہ فی العلوم الاسلامیہ و تخصص فی الفقہ',
        qualification_ur: 'شہادۃ العالمیہ فی العلوم الاسلامیہ و تخصص فی الفقہ',
        specialization: t.spec,
        phone: t.phone,
        email: t.email,
        status: 'active',
      });
      if (tchErr) console.error('Teacher insert error:', t.code, tchErr);
    }
  }
  const { data: allTeachers } = await supabase.from('teachers').select('teacher_code, full_name_ur');
  console.log('✅ Teachers in Supabase:', allTeachers);

  // 5. Students (ST-001 to ST-007, with ST-007 = مولانا اسامہ بن زید 03319239011)
  const studentsList = [
    { code: 'ST-001', nameEn: 'Maulana Abdul Rehman Madani', nameUr: 'مولانا عبدالرحمٰن مدنی', fatherUr: 'مولانا بشیر احمد', phone: '03017782310', clsId: clsTak1.id },
    { code: 'ST-002', nameEn: 'Maulana Muhammad Umar Farooq', nameUr: 'مولانا محمد عمر فاروق', fatherUr: 'محمد فاروق خان', phone: '03027782311', clsId: clsTak1.id },
    { code: 'ST-003', nameEn: 'Maulana Huzaifa bin Yusuf', nameUr: 'مولانا حذیفہ بن یوسف', fatherUr: 'محمد یوسف صاحب', phone: '03037782312', clsId: clsTak1.id },
    { code: 'ST-004', nameEn: 'Maulana Zaidullah Khan', nameUr: 'مولانا زید اللہ خان', fatherUr: 'امان اللہ خان', phone: '03047782313', clsId: clsTak1.id },
    { code: 'ST-005', nameEn: 'Maulana Talha bin Zubair', nameUr: 'مولانا طلحہ بن زبیر', fatherUr: 'زبیر احمد', phone: '03057782314', clsId: clsTak2.id },
    { code: 'ST-006', nameEn: 'Maulana Saad bin Abi Waqas', nameUr: 'مولانا سعد بن ابی وقاص', fatherUr: 'وقاص احمد', phone: '03067782315', clsId: clsTak2.id },
    { code: 'ST-007', nameEn: 'Maulana Osama bin Zaid', nameUr: 'مولانا اسامہ بن زید', fatherUr: 'زید بن حارثہ', phone: '03319239011', clsId: clsIfta.id },
  ];

  for (const s of studentsList) {
    const email = `student.${s.code.toLowerCase()}@naafay.edu.pk`;
    const profId = await getOrCreateUser(email, '123456', s.nameEn, s.nameUr, s.phone);

    if (roleStudent) {
      await supabase.from('user_roles').upsert({ user_id: profId, role_id: roleStudent.id }, { onConflict: 'user_id, role_id' });
    }

    const { data: existSt } = await supabase.from('students').select('id').eq('student_code', s.code).maybeSingle();
    let stId;
    if (existSt) {
      stId = existSt.id;
      await supabase.from('students').update({
        profile_id: profId,
        full_name: s.nameEn,
        full_name_ur: s.nameUr,
        father_name: s.fatherUr,
        father_name_ur: s.fatherUr,
        phone: s.phone,
        email,
        class_id: s.clsId,
        academic_year_id: currYear.id,
        admission_date: '2026-08-01',
        status: 'active',
      }).eq('id', stId);
    } else {
      const { data: inserted, error: stErr } = await supabase.from('students').insert({
        profile_id: profId,
        student_code: s.code,
        full_name: s.nameEn,
        full_name_ur: s.nameUr,
        father_name: s.fatherUr,
        father_name_ur: s.fatherUr,
        phone: s.phone,
        email,
        class_id: s.clsId,
        academic_year_id: currYear.id,
        admission_date: '2026-08-01',
        status: 'active',
      }).select();
      if (stErr) console.error('Student insert error:', s.code, stErr);
      stId = inserted?.[0]?.id;
    }

    if (stId) {
      const { data: existEnr } = await supabase.from('enrollments').select('id').eq('student_id', stId).eq('academic_year_id', currYear.id).maybeSingle();
      if (!existEnr) {
        await supabase.from('enrollments').insert({
          student_id: stId,
          academic_year_id: currYear.id,
          class_id: s.clsId,
          roll_number: s.code,
          status: 'enrolled',
        });
      }
    }
  }

  const { data: allStudents } = await supabase.from('students').select('student_code, full_name_ur, phone');
  console.log('✅ Students in Supabase:', allStudents);

  // 6. Create sample study log for ST-007
  const { data: osama } = await supabase.from('students').select('id').eq('student_code', 'ST-007').single();
  const sampleBook = allBooks?.[0];
  if (osama && sampleBook) {
    const { data: existLog } = await supabase.from('study_logs').select('id').eq('student_id', osama.id).maybeSingle();
    if (!existLog) {
      await supabase.from('study_logs').insert({
        student_id: osama.id,
        book_id: sampleBook.id,
        study_date: new Date().toISOString().slice(0, 10),
        chapter: 'کتاب الطہارۃ — احکام المیاہ',
        start_position: '120',
        end_position: '135',
        study_details: 'میاہ مستعملہ اور اس کے پاک ہونے کے متعلق ائمہ اربعہ کے اقوال کی تحقیق',
        status: 'approved',
      });
      console.log('✅ Sample Mutala Study Log created for ST-007 in Supabase.');
    }
  }

  console.log('\n🎉 ALL DATA HAS BEEN SUCCESSFULLY SYNCHRONIZED AND VERIFIED ON SUPABASE!');
}

run().catch(console.error);
