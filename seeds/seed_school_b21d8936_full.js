const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SCHOOL_ID = 'b21d8936-e0e4-4713-a7e2-64217333203c';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const teacherRecords = [
  {
    teacher_id: '60000000-0000-4000-8000-000000000001',
    full_name: 'Ahmad Fauzi, S.Pd.',
    email: 'guru.matematika.demo@sekolah.id',
    phone: '081200000001',
    nip: '198701012010011001',
    password: 'GuruDemo123!',
  },
  {
    teacher_id: '60000000-0000-4000-8000-000000000002',
    full_name: 'Rina Kartika, S.Pd.',
    email: 'guru.bindo.demo@sekolah.id',
    phone: '081200000002',
    nip: '198902022011012002',
    password: 'GuruDemo123!',
  },
  {
    teacher_id: '60000000-0000-4000-8000-000000000003',
    full_name: 'Dedi Pratama, S.Kom.',
    email: 'guru.informatika.demo@sekolah.id',
    phone: '081200000003',
    nip: '199003032012013003',
    password: 'GuruDemo123!',
  },
];

const classes = [
  { id: '70000000-0000-4000-8000-000000000001', name: 'Kelas 8', major: '', grade: '8' },
  { id: '70000000-0000-4000-8000-000000000002', name: 'Kelas 9', major: '', grade: '9' },
  { id: '70000000-0000-4000-8000-000000000003', name: '10 RPL 1', major: 'RPL', grade: '10' },
  { id: '70000000-0000-4000-8000-000000000004', name: '11 RPL 2', major: 'RPL', grade: '11' },
  { id: '70000000-0000-4000-8000-000000000005', name: '12 MIPA 1', major: 'MIPA', grade: '12' },
];

const studentRecords = [
  { full_name: 'Alya Putri', email: 'siswa.demo.001@sekolah.id', phone: '081300000001', nisn: '2600000001', username: '2600000001', class_id: '70000000-0000-4000-8000-000000000001' },
  { full_name: 'Bima Ramadhan', email: 'siswa.demo.002@sekolah.id', phone: '081300000002', nisn: '2600000002', username: '2600000002', class_id: '70000000-0000-4000-8000-000000000001' },
  { full_name: 'Citra Lestari', email: 'siswa.demo.003@sekolah.id', phone: '081300000003', nisn: '2600000003', username: '2600000003', class_id: '70000000-0000-4000-8000-000000000002' },
  { full_name: 'Dafa Maulana', email: 'siswa.demo.004@sekolah.id', phone: '081300000004', nisn: '2600000004', username: '2600000004', class_id: '70000000-0000-4000-8000-000000000002' },
  { full_name: 'Elsa Maharani', email: 'siswa.demo.005@sekolah.id', phone: '081300000005', nisn: '2600000005', username: '2600000005', class_id: '70000000-0000-4000-8000-000000000003' },
  { full_name: 'Farhan Akbar', email: 'siswa.demo.006@sekolah.id', phone: '081300000006', nisn: '2600000006', username: '2600000006', class_id: '70000000-0000-4000-8000-000000000003' },
  { full_name: 'Gita Ananda', email: 'siswa.demo.007@sekolah.id', phone: '081300000007', nisn: '2600000007', username: '2600000007', class_id: '70000000-0000-4000-8000-000000000004' },
  { full_name: 'Hafiz Nugraha', email: 'siswa.demo.008@sekolah.id', phone: '081300000008', nisn: '2600000008', username: '2600000008', class_id: '70000000-0000-4000-8000-000000000004' },
  { full_name: 'Intan Permata', email: 'siswa.demo.009@sekolah.id', phone: '081300000009', nisn: '2600000009', username: '2600000009', class_id: '70000000-0000-4000-8000-000000000005' },
  { full_name: 'Jovan Saputra', email: 'siswa.demo.010@sekolah.id', phone: '081300000010', nisn: '2600000010', username: '2600000010', class_id: '70000000-0000-4000-8000-000000000005' },
].map((item, index) => ({ ...item, password: 'SiswaDemo123!', seq: index + 1 }));

const subjects = [
  { id: '80000000-0000-4000-8000-000000000001', teacher_email: 'guru.matematika.demo@sekolah.id', code: 'MAT-12', name: 'Matematika', class_id: '70000000-0000-4000-8000-000000000005' },
  { id: '80000000-0000-4000-8000-000000000002', teacher_email: 'guru.bindo.demo@sekolah.id', code: 'BIN-11', name: 'Bahasa Indonesia', class_id: '70000000-0000-4000-8000-000000000004' },
  { id: '80000000-0000-4000-8000-000000000003', teacher_email: 'guru.informatika.demo@sekolah.id', code: 'INF-10', name: 'Informatika', class_id: '70000000-0000-4000-8000-000000000003' },
];

const bundle = {
  id: '90000000-0000-4000-8000-000000000001',
  title: 'UTS Gasal 2026 Demo',
  bundle_type: 'uts',
  academic_year: '2026/2027',
  semester: 'gasal',
  description: 'Bundle demo untuk pengujian dashboard dan aplikasi ujian.',
  status: 'published',
  start_date: '2026-09-14T00:00:00.000Z',
  end_date: '2026-09-20T10:00:00.000Z',
};

const exam = {
  id: '92000000-0000-4000-8000-000000000001',
  subject_id: '80000000-0000-4000-8000-000000000001',
  class_id: '70000000-0000-4000-8000-000000000005',
  teacher_email: 'guru.matematika.demo@sekolah.id',
  title: 'UTS Gasal 2026 - Matematika - 12 MIPA 1',
  type: 'pg',
  duration_minutes: 90,
  total_pg: 30,
  total_essay: 0,
  passing_grade: 75,
  shuffle_questions: true,
  shuffle_answers: true,
  status: 'approved',
  question_deadline: '2026-09-10T16:59:00.000Z',
};

const schedule = {
  id: '93000000-0000-4000-8000-000000000001',
  start_time: '2026-09-15T01:00:00.000Z',
  end_time: '2026-09-15T02:30:00.000Z',
  status: 'scheduled',
};

function buildQuestions(teacherId) {
  const prompts = [
    ['Hasil dari 12 + 8 adalah ...', '18', '19', '20', '21', '22', 'C', 'Penjumlahan dasar.'],
    ['Hasil dari 15 x 3 adalah ...', '35', '40', '45', '50', '55', 'C', 'Perkalian dasar.'],
    ['Bentuk sederhana dari 24 : 6 adalah ...', '2', '3', '4', '5', '6', 'C', 'Pembagian dasar.'],
    ['Nilai dari 7^2 adalah ...', '14', '21', '42', '49', '56', 'D', 'Pangkat dua.'],
    ['Akar kuadrat dari 81 adalah ...', '7', '8', '9', '10', '11', 'C', 'Akar kuadrat.'],
    ['Bentuk pecahan dari 0,25 adalah ...', '1/2', '1/3', '1/4', '1/5', '1/6', 'C', 'Konversi desimal ke pecahan.'],
    ['Hasil dari 5/6 + 1/6 adalah ...', '1/2', '2/3', '5/6', '1', '7/6', 'D', 'Penjumlahan pecahan.'],
    ['Jika x = 4, maka 3x + 2 = ...', '10', '12', '14', '16', '18', 'C', 'Substitusi aljabar.'],
    ['Keliling persegi dengan sisi 6 cm adalah ...', '12 cm', '18 cm', '24 cm', '30 cm', '36 cm', 'C', 'Rumus keliling persegi.'],
    ['Luas persegi panjang dengan panjang 8 cm dan lebar 5 cm adalah ...', '13 cm2', '20 cm2', '35 cm2', '40 cm2', '45 cm2', 'D', 'Rumus luas persegi panjang.'],
    ['Bentuk persen dari 0,7 adalah ...', '7%', '17%', '70%', '700%', '0,7%', 'C', 'Konversi desimal ke persen.'],
    ['Rata-rata dari 6, 8, 10 adalah ...', '7', '8', '9', '10', '11', 'B', 'Rata-rata sederhana.'],
    ['Bilangan prima di bawah ini adalah ...', '21', '27', '31', '33', '39', 'C', 'Identifikasi bilangan prima.'],
    ['FPB dari 18 dan 24 adalah ...', '4', '6', '8', '12', '18', 'B', 'Faktor persekutuan terbesar.'],
    ['KPK dari 6 dan 8 adalah ...', '12', '18', '24', '36', '48', 'C', 'Kelipatan persekutuan terkecil.'],
    ['Nilai dari 2x - 5 = 9, maka x = ...', '5', '6', '7', '8', '9', 'C', 'Persamaan linear satu variabel.'],
    ['Sudut siku-siku besarnya ...', '45°', '60°', '75°', '90°', '120°', 'D', 'Jenis sudut.'],
    ['Bilangan negatif yang lebih besar adalah ...', '-9', '-7', '-5', '-3', '-1', 'E', 'Perbandingan bilangan negatif.'],
    ['3/4 dari 20 adalah ...', '5', '10', '12', '15', '18', 'D', 'Operasi pecahan.'],
    ['Hasil dari 2,5 + 1,75 adalah ...', '3,25', '4,00', '4,25', '4,50', '4,75', 'C', 'Penjumlahan desimal.'],
    ['Koordinat titik asal pada bidang kartesius adalah ...', '(1,1)', '(0,1)', '(1,0)', '(0,0)', '(-1,-1)', 'D', 'Titik asal koordinat.'],
    ['Jika 5 buku seharga 40.000, maka harga 1 buku adalah ...', '5.000', '6.000', '7.000', '8.000', '9.000', 'D', 'Perbandingan senilai.'],
    ['Volume kubus dengan sisi 4 cm adalah ...', '16 cm3', '32 cm3', '48 cm3', '64 cm3', '96 cm3', 'D', 'Rumus volume kubus.'],
    ['Bentuk sederhana dari 18/24 adalah ...', '2/3', '3/4', '4/5', '5/6', '6/7', 'B', 'Menyederhanakan pecahan.'],
    ['Persentase 25% dari 200 adalah ...', '25', '40', '50', '75', '100', 'C', 'Menghitung persen.'],
    ['Hasil dari 9 - (-4) adalah ...', '5', '11', '13', '-13', '-5', 'C', 'Operasi bilangan bulat.'],
    ['Median dari data 2, 3, 5, 7, 11 adalah ...', '3', '4', '5', '6', '7', 'C', 'Statistika dasar.'],
    ['Sebuah segitiga memiliki jumlah sudut sebesar ...', '90°', '120°', '180°', '270°', '360°', 'C', 'Jumlah sudut segitiga.'],
    ['Nilai dari 4! (faktorial) adalah ...', '8', '12', '16', '20', '24', 'E', 'Faktorial.'],
    ['Jika y = 3 dan x = 2, maka 2x + y = ...', '5', '6', '7', '8', '9', 'C', 'Substitusi dua variabel sederhana.'],
  ];

  return prompts.map((item, index) => ({
    id: `94000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    exam_id: exam.id,
    teacher_id: teacherId,
    question_type: 'pg',
    question_text: item[0],
    option_a: item[1],
    option_b: item[2],
    option_c: item[3],
    option_d: item[4],
    option_e: item[5],
    correct_answer: item[6],
    score_weight: 1,
    explanation: item[7],
    order_number: index + 1,
    created_at: new Date().toISOString(),
  }));
}

async function ensureSchoolExists() {
  const { data, error } = await supabase.from('schools').select('id,name').eq('id', SCHOOL_ID).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`School ${SCHOOL_ID} tidak ditemukan.`);
  return data;
}

async function findAuthUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = (data.users || []).find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (!data.users || data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureAuthUser({ email, password, full_name, role, phone }) {
  let user = await findAuthUserByEmail(email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, school_id: SCHOOL_ID, phone },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email,
      password,
      user_metadata: { ...(user.user_metadata || {}), full_name, role, school_id: SCHOOL_ID, phone },
    });
    if (error) throw error;
    user = data.user;
  }
  return user;
}

async function upsertProfiles(users, role) {
  const rows = users.map((item) => ({
    id: item.auth_id,
    school_id: SCHOOL_ID,
    full_name: item.full_name,
    email: item.email,
    phone: item.phone,
    role,
    status: 'active',
    created_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('profiles').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

async function cleanupExistingSeedData() {
  const teacherEmails = teacherRecords.map((item) => item.email);
  const studentEmails = studentRecords.map((item) => item.email);
  const seededEmails = [...teacherEmails, ...studentEmails];
  const { data: existingProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id,email')
    .in('email', seededEmails);
  if (profilesError) throw profilesError;
  const existingProfileIds = (existingProfiles || []).map((item) => item.id);

  await supabase.from('exam_questions').delete().eq('exam_id', exam.id);
  await supabase.from('exam_schedules').delete().eq('exam_id', exam.id);
  await supabase.from('exam_bundle_students').delete().eq('bundle_id', bundle.id);
  await supabase.from('exams').delete().eq('id', exam.id);
  await supabase.from('exam_bundles').delete().eq('id', bundle.id);
  await supabase.from('subjects').delete().in('id', subjects.map((item) => item.id));
  if (existingProfileIds.length) {
    await supabase.from('teachers').delete().in('profile_id', existingProfileIds);
    await supabase.from('students').delete().in('id', existingProfileIds);
    await supabase.from('profiles').delete().in('id', existingProfileIds);
  }
  await supabase.from('classes').delete().in('id', classes.map((item) => item.id));
}

async function main() {
  const school = await ensureSchoolExists();
  await cleanupExistingSeedData();

  const teacherUsers = [];
  for (const teacher of teacherRecords) {
    const authUser = await ensureAuthUser({ ...teacher, role: 'guru' });
    teacherUsers.push({ ...teacher, auth_id: authUser.id });
  }

  const studentUsers = [];
  for (const student of studentRecords) {
    const authUser = await ensureAuthUser({ ...student, role: 'siswa' });
    studentUsers.push({ ...student, auth_id: authUser.id });
  }

  await upsertProfiles(teacherUsers, 'guru');
  await upsertProfiles(studentUsers, 'siswa');

  const { error: teachersError } = await supabase.from('teachers').upsert(
    teacherUsers.map((teacher) => ({
      id: teacher.teacher_id,
      school_id: SCHOOL_ID,
      profile_id: teacher.auth_id,
      nip: teacher.nip,
      full_name: teacher.full_name,
      email: teacher.email,
      phone: teacher.phone,
      status: 'active',
    })),
    { onConflict: 'id' },
  );
  if (teachersError) throw teachersError;

  const { error: classesError } = await supabase.from('classes').upsert(
    classes.map((item) => ({ ...item, school_id: SCHOOL_ID })),
    { onConflict: 'id' },
  );
  if (classesError) throw classesError;

  const { error: studentsError } = await supabase.from('students').upsert(
    studentUsers.map((student) => ({
      id: student.auth_id,
      school_id: SCHOOL_ID,
      class_id: student.class_id,
      nisn: student.nisn,
      full_name: student.full_name,
      username: student.username,
      status: 'active',
    })),
    { onConflict: 'id' },
  );
  if (studentsError) throw studentsError;

  const teacherIdByEmail = new Map(teacherUsers.map((teacher) => [teacher.email, teacher.auth_id]));

  const { error: subjectsError } = await supabase.from('subjects').upsert(
    subjects.map((subject) => ({
      id: subject.id,
      school_id: SCHOOL_ID,
      teacher_id: teacherIdByEmail.get(subject.teacher_email) || null,
      code: subject.code,
      name: subject.name,
      class_id: subject.class_id,
    })),
    { onConflict: 'id' },
  );
  if (subjectsError) throw subjectsError;

  const { error: bundleError } = await supabase.from('exam_bundles').upsert(
    [{ id: bundle.id, school_id: SCHOOL_ID, ...bundle, created_at: new Date().toISOString() }],
    { onConflict: 'id' },
  );
  if (bundleError) throw bundleError;

  const bundleStudentRows = studentUsers
    .filter((student) => student.class_id === '70000000-0000-4000-8000-000000000005')
    .map((student, index) => ({
      id: `91000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      bundle_id: bundle.id,
      student_id: student.auth_id,
      created_at: new Date().toISOString(),
    }));
  const { error: bundleStudentsError } = await supabase.from('exam_bundle_students').upsert(bundleStudentRows, { onConflict: 'id' });
  if (bundleStudentsError) throw bundleStudentsError;

  const mathTeacherId = teacherIdByEmail.get(exam.teacher_email);
  const { error: examError } = await supabase.from('exams').upsert(
    [{
      id: exam.id,
      school_id: SCHOOL_ID,
      bundle_id: bundle.id,
      subject_id: exam.subject_id,
      class_id: exam.class_id,
      teacher_id: mathTeacherId,
      title: exam.title,
      type: exam.type,
      duration_minutes: exam.duration_minutes,
      total_pg: exam.total_pg,
      total_essay: exam.total_essay,
      passing_grade: exam.passing_grade,
      shuffle_questions: exam.shuffle_questions,
      shuffle_answers: exam.shuffle_answers,
      status: exam.status,
      question_deadline: exam.question_deadline,
      created_at: new Date().toISOString(),
    }],
    { onConflict: 'id' },
  );
  if (examError) throw examError;

  const { error: scheduleError } = await supabase.from('exam_schedules').upsert(
    [{
      id: schedule.id,
      exam_id: exam.id,
      school_id: SCHOOL_ID,
      class_id: exam.class_id,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      status: schedule.status,
    }],
    { onConflict: 'id' },
  );
  if (scheduleError) throw scheduleError;

  const { error: questionsError } = await supabase.from('exam_questions').upsert(buildQuestions(mathTeacherId), { onConflict: 'id' });
  if (questionsError) throw questionsError;

  console.log(JSON.stringify({
    success: true,
    school: { id: school.id, name: school.name },
    teacher_login: teacherUsers.map((item) => ({ email: item.email, password: item.password })),
    student_login: studentUsers.map((item) => ({ username: item.username, email: item.email, password: item.password })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
