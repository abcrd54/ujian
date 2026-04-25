-- Seed khusus sekolah: b21d8936-e0e4-4713-a7e2-64217333203c
-- Isi:
-- 3 guru, 10 siswa, 5 kelas, 3 mapel, 1 bundle ujian, 1 exam, 30 soal PG, 1 jadwal ujian.
-- Catatan:
-- - File ini mengisi data relasional di public schema.
-- - File ini TIDAK membuat auth.users, jadi login guru/siswa belum otomatis tersedia.
-- - Jalankan setelah school dengan id di bawah ini sudah ada.

begin;

-- =========================================================
-- GUARD
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from public.schools
    where id = 'b21d8936-e0e4-4713-a7e2-64217333203c'::uuid
  ) then
    raise exception 'School % tidak ditemukan. Buat sekolahnya dulu.', 'b21d8936-e0e4-4713-a7e2-64217333203c';
  end if;
end $$;

-- =========================================================
-- PROFILES GURU
-- =========================================================
insert into public.profiles (id, school_id, full_name, email, phone, role, status, created_at)
values
  ('40000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Ahmad Fauzi, S.Pd.', 'guru.matematika.demo@sekolah.id', '081200000001', 'guru', 'active', now()),
  ('40000000-0000-4000-8000-000000000002', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Rina Kartika, S.Pd.', 'guru.bindo.demo@sekolah.id', '081200000002', 'guru', 'active', now()),
  ('40000000-0000-4000-8000-000000000003', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Dedi Pratama, S.Kom.', 'guru.informatika.demo@sekolah.id', '081200000003', 'guru', 'active', now())
on conflict (id) do update
set school_id = excluded.school_id,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    status = excluded.status;

-- =========================================================
-- PROFILES SISWA
-- =========================================================
insert into public.profiles (id, school_id, full_name, email, phone, role, status, created_at)
values
  ('50000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Alya Putri', 'siswa.demo.001@sekolah.id', '081300000001', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000002', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Bima Ramadhan', 'siswa.demo.002@sekolah.id', '081300000002', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000003', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Citra Lestari', 'siswa.demo.003@sekolah.id', '081300000003', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000004', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Dafa Maulana', 'siswa.demo.004@sekolah.id', '081300000004', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000005', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Elsa Maharani', 'siswa.demo.005@sekolah.id', '081300000005', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000006', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Farhan Akbar', 'siswa.demo.006@sekolah.id', '081300000006', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000007', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Gita Ananda', 'siswa.demo.007@sekolah.id', '081300000007', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000008', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Hafiz Nugraha', 'siswa.demo.008@sekolah.id', '081300000008', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000009', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Intan Permata', 'siswa.demo.009@sekolah.id', '081300000009', 'siswa', 'active', now()),
  ('50000000-0000-4000-8000-000000000010', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Jovan Saputra', 'siswa.demo.010@sekolah.id', '081300000010', 'siswa', 'active', now())
on conflict (id) do update
set school_id = excluded.school_id,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    status = excluded.status;

-- =========================================================
-- TEACHERS
-- =========================================================
insert into public.teachers (id, school_id, profile_id, nip, full_name, email, phone, status)
values
  ('60000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', '40000000-0000-4000-8000-000000000001', '198701012010011001', 'Ahmad Fauzi, S.Pd.', 'guru.matematika.demo@sekolah.id', '081200000001', 'active'),
  ('60000000-0000-4000-8000-000000000002', 'b21d8936-e0e4-4713-a7e2-64217333203c', '40000000-0000-4000-8000-000000000002', '198902022011012002', 'Rina Kartika, S.Pd.', 'guru.bindo.demo@sekolah.id', '081200000002', 'active'),
  ('60000000-0000-4000-8000-000000000003', 'b21d8936-e0e4-4713-a7e2-64217333203c', '40000000-0000-4000-8000-000000000003', '199003032012013003', 'Dedi Pratama, S.Kom.', 'guru.informatika.demo@sekolah.id', '081200000003', 'active')
on conflict (id) do update
set school_id = excluded.school_id,
    profile_id = excluded.profile_id,
    nip = excluded.nip,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    status = excluded.status;

-- =========================================================
-- CLASSES
-- =========================================================
insert into public.classes (id, school_id, name, major, grade)
values
  ('70000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Kelas 8', '', '8'),
  ('70000000-0000-4000-8000-000000000002', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'Kelas 9', '', '9'),
  ('70000000-0000-4000-8000-000000000003', 'b21d8936-e0e4-4713-a7e2-64217333203c', '10 RPL 1', 'RPL', '10'),
  ('70000000-0000-4000-8000-000000000004', 'b21d8936-e0e4-4713-a7e2-64217333203c', '11 RPL 2', 'RPL', '11'),
  ('70000000-0000-4000-8000-000000000005', 'b21d8936-e0e4-4713-a7e2-64217333203c', '12 MIPA 1', 'MIPA', '12')
on conflict (id) do update
set school_id = excluded.school_id,
    name = excluded.name,
    major = excluded.major,
    grade = excluded.grade;

-- =========================================================
-- STUDENTS (10 siswa, dibagi ke 5 kelas)
-- =========================================================
insert into public.students (id, school_id, class_id, nisn, full_name, username, status)
values
  ('50000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000001', '2600000001', 'Alya Putri', '2600000001', 'active'),
  ('50000000-0000-4000-8000-000000000002', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000001', '2600000002', 'Bima Ramadhan', '2600000002', 'active'),
  ('50000000-0000-4000-8000-000000000003', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000002', '2600000003', 'Citra Lestari', '2600000003', 'active'),
  ('50000000-0000-4000-8000-000000000004', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000002', '2600000004', 'Dafa Maulana', '2600000004', 'active'),
  ('50000000-0000-4000-8000-000000000005', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000003', '2600000005', 'Elsa Maharani', '2600000005', 'active'),
  ('50000000-0000-4000-8000-000000000006', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000003', '2600000006', 'Farhan Akbar', '2600000006', 'active'),
  ('50000000-0000-4000-8000-000000000007', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000004', '2600000007', 'Gita Ananda', '2600000007', 'active'),
  ('50000000-0000-4000-8000-000000000008', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000004', '2600000008', 'Hafiz Nugraha', '2600000008', 'active'),
  ('50000000-0000-4000-8000-000000000009', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000005', '2600000009', 'Intan Permata', '2600000009', 'active'),
  ('50000000-0000-4000-8000-000000000010', 'b21d8936-e0e4-4713-a7e2-64217333203c', '70000000-0000-4000-8000-000000000005', '2600000010', 'Jovan Saputra', '2600000010', 'active')
on conflict (id) do update
set school_id = excluded.school_id,
    class_id = excluded.class_id,
    nisn = excluded.nisn,
    full_name = excluded.full_name,
    username = excluded.username,
    status = excluded.status;

-- =========================================================
-- SUBJECTS
-- =========================================================
insert into public.subjects (id, school_id, teacher_id, code, name, class_id)
values
  ('80000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', '40000000-0000-4000-8000-000000000001', 'MAT-12', 'Matematika', '70000000-0000-4000-8000-000000000005'),
  ('80000000-0000-4000-8000-000000000002', 'b21d8936-e0e4-4713-a7e2-64217333203c', '40000000-0000-4000-8000-000000000002', 'BIN-11', 'Bahasa Indonesia', '70000000-0000-4000-8000-000000000004'),
  ('80000000-0000-4000-8000-000000000003', 'b21d8936-e0e4-4713-a7e2-64217333203c', '40000000-0000-4000-8000-000000000003', 'INF-10', 'Informatika', '70000000-0000-4000-8000-000000000003')
on conflict (id) do update
set school_id = excluded.school_id,
    teacher_id = excluded.teacher_id,
    code = excluded.code,
    name = excluded.name,
    class_id = excluded.class_id;

-- =========================================================
-- BUNDLE UJIAN
-- =========================================================
insert into public.exam_bundles (id, school_id, title, bundle_type, academic_year, semester, description, status, start_date, end_date, created_at)
values
  ('90000000-0000-4000-8000-000000000001', 'b21d8936-e0e4-4713-a7e2-64217333203c', 'UTS Gasal 2026 Demo', 'uts', '2026/2027', 'gasal', 'Bundle demo untuk pengujian dashboard dan aplikasi ujian.', 'published', '2026-09-14 07:00:00+07', '2026-09-20 17:00:00+07', now())
on conflict (id) do update
set school_id = excluded.school_id,
    title = excluded.title,
    bundle_type = excluded.bundle_type,
    academic_year = excluded.academic_year,
    semester = excluded.semester,
    description = excluded.description,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date;

-- =========================================================
-- EXAM BUNDLE STUDENTS (khusus kelas 12 MIPA 1)
-- =========================================================
insert into public.exam_bundle_students (id, bundle_id, student_id, created_at)
values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000009', now()),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000010', now())
on conflict (id) do update
set bundle_id = excluded.bundle_id,
    student_id = excluded.student_id;

-- =========================================================
-- EXAM (1 mapel ujian, 30 PG)
-- =========================================================
insert into public.exams (
  id, school_id, bundle_id, subject_id, class_id, teacher_id, title, type,
  duration_minutes, total_pg, total_essay, passing_grade,
  shuffle_questions, shuffle_answers, status, question_deadline, created_at
)
values (
  '92000000-0000-4000-8000-000000000001',
  'b21d8936-e0e4-4713-a7e2-64217333203c',
  '90000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000001',
  'UTS Gasal 2026 - Matematika - 12 MIPA 1',
  'pg',
  90,
  30,
  0,
  75,
  true,
  true,
  'approved',
  '2026-09-10 23:59:00+07',
  now()
)
on conflict (id) do update
set school_id = excluded.school_id,
    bundle_id = excluded.bundle_id,
    subject_id = excluded.subject_id,
    class_id = excluded.class_id,
    teacher_id = excluded.teacher_id,
    title = excluded.title,
    type = excluded.type,
    duration_minutes = excluded.duration_minutes,
    total_pg = excluded.total_pg,
    total_essay = excluded.total_essay,
    passing_grade = excluded.passing_grade,
    shuffle_questions = excluded.shuffle_questions,
    shuffle_answers = excluded.shuffle_answers,
    status = excluded.status,
    question_deadline = excluded.question_deadline;

-- =========================================================
-- EXAM SCHEDULE
-- =========================================================
insert into public.exam_schedules (id, exam_id, school_id, class_id, start_time, end_time, status)
values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'b21d8936-e0e4-4713-a7e2-64217333203c',
  '70000000-0000-4000-8000-000000000005',
  '2026-09-15 08:00:00+07',
  '2026-09-15 09:30:00+07',
  'scheduled'
)
on conflict (id) do update
set exam_id = excluded.exam_id,
    school_id = excluded.school_id,
    class_id = excluded.class_id,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    status = excluded.status;

-- =========================================================
-- 30 SOAL PG
-- =========================================================
insert into public.exam_questions (
  id, exam_id, teacher_id, question_type, question_text,
  option_a, option_b, option_c, option_d, option_e,
  correct_answer, score_weight, explanation, order_number, created_at
)
values
  ('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Hasil dari 12 + 8 adalah ...','18','19','20','21','22','C',1,'Penjumlahan dasar.',1,now()),
  ('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Hasil dari 15 x 3 adalah ...','35','40','45','50','55','C',1,'Perkalian dasar.',2,now()),
  ('94000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Bentuk sederhana dari 24 : 6 adalah ...','2','3','4','5','6','C',1,'Pembagian dasar.',3,now()),
  ('94000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Nilai dari 7^2 adalah ...','14','21','42','49','56','D',1,'Pangkat dua.',4,now()),
  ('94000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Akar kuadrat dari 81 adalah ...','7','8','9','10','11','C',1,'Akar kuadrat.',5,now()),
  ('94000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Bentuk pecahan dari 0,25 adalah ...','1/2','1/3','1/4','1/5','1/6','C',1,'Konversi desimal ke pecahan.',6,now()),
  ('94000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Hasil dari 5/6 + 1/6 adalah ...','1/2','2/3','5/6','1','7/6','D',1,'Penjumlahan pecahan.',7,now()),
  ('94000000-0000-4000-8000-000000000008','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Jika x = 4, maka 3x + 2 = ...','10','12','14','16','18','C',1,'Substitusi aljabar.',8,now()),
  ('94000000-0000-4000-8000-000000000009','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Keliling persegi dengan sisi 6 cm adalah ...','12 cm','18 cm','24 cm','30 cm','36 cm','C',1,'Rumus keliling persegi.',9,now()),
  ('94000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Luas persegi panjang dengan panjang 8 cm dan lebar 5 cm adalah ...','13 cm2','20 cm2','35 cm2','40 cm2','45 cm2','D',1,'Rumus luas persegi panjang.',10,now()),
  ('94000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Bentuk persen dari 0,7 adalah ...','7%','17%','70%','700%','0,7%','C',1,'Konversi desimal ke persen.',11,now()),
  ('94000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Rata-rata dari 6, 8, 10 adalah ...','7','8','9','10','11','B',1,'Rata-rata sederhana.',12,now()),
  ('94000000-0000-4000-8000-000000000013','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Bilangan prima di bawah ini adalah ...','21','27','31','33','39','C',1,'Identifikasi bilangan prima.',13,now()),
  ('94000000-0000-4000-8000-000000000014','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','FPB dari 18 dan 24 adalah ...','4','6','8','12','18','B',1,'Faktor persekutuan terbesar.',14,now()),
  ('94000000-0000-4000-8000-000000000015','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','KPK dari 6 dan 8 adalah ...','12','18','24','36','48','C',1,'Kelipatan persekutuan terkecil.',15,now()),
  ('94000000-0000-4000-8000-000000000016','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Nilai dari 2x - 5 = 9, maka x = ...','5','6','7','8','9','C',1,'Persamaan linear satu variabel.',16,now()),
  ('94000000-0000-4000-8000-000000000017','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Sudut siku-siku besarnya ...','45°','60°','75°','90°','120°','D',1,'Jenis sudut.',17,now()),
  ('94000000-0000-4000-8000-000000000018','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Bilangan negatif yang lebih besar adalah ...','-9','-7','-5','-3','-1','E',1,'Perbandingan bilangan negatif.',18,now()),
  ('94000000-0000-4000-8000-000000000019','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','3/4 dari 20 adalah ...','5','10','12','15','18','D',1,'Operasi pecahan.',19,now()),
  ('94000000-0000-4000-8000-000000000020','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Hasil dari 2,5 + 1,75 adalah ...','3,25','4,00','4,25','4,50','4,75','C',1,'Penjumlahan desimal.',20,now()),
  ('94000000-0000-4000-8000-000000000021','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Koordinat titik asal pada bidang kartesius adalah ...','(1,1)','(0,1)','(1,0)','(0,0)','(-1,-1)','D',1,'Titik asal koordinat.',21,now()),
  ('94000000-0000-4000-8000-000000000022','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Jika 5 buku seharga 40.000, maka harga 1 buku adalah ...','5.000','6.000','7.000','8.000','9.000','D',1,'Perbandingan senilai.',22,now()),
  ('94000000-0000-4000-8000-000000000023','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Volume kubus dengan sisi 4 cm adalah ...','16 cm3','32 cm3','48 cm3','64 cm3','96 cm3','D',1,'Rumus volume kubus.',23,now()),
  ('94000000-0000-4000-8000-000000000024','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Bentuk sederhana dari 18/24 adalah ...','2/3','3/4','4/5','5/6','6/7','B',1,'Menyederhanakan pecahan.',24,now()),
  ('94000000-0000-4000-8000-000000000025','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Persentase 25% dari 200 adalah ...','25','40','50','75','100','C',1,'Menghitung persen.',25,now()),
  ('94000000-0000-4000-8000-000000000026','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Hasil dari 9 - (-4) adalah ...','5','11','13','-13','-5','C',1,'Operasi bilangan bulat.',26,now()),
  ('94000000-0000-4000-8000-000000000027','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Median dari data 2, 3, 5, 7, 11 adalah ...','3','4','5','6','7','C',1,'Statistika dasar.',27,now()),
  ('94000000-0000-4000-8000-000000000028','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Sebuah segitiga memiliki jumlah sudut sebesar ...','90°','120°','180°','270°','360°','C',1,'Jumlah sudut segitiga.',28,now()),
  ('94000000-0000-4000-8000-000000000029','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Nilai dari 4!(faktorial) adalah ...','8','12','16','20','24','E',1,'Faktorial.',29,now()),
  ('94000000-0000-4000-8000-000000000030','92000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','pg','Jika y = 3 dan x = 2, maka 2x + y = ...','5','6','7','8','9','C',1,'Substitusi dua variabel sederhana.',30,now())
on conflict (id) do update
set exam_id = excluded.exam_id,
    teacher_id = excluded.teacher_id,
    question_type = excluded.question_type,
    question_text = excluded.question_text,
    option_a = excluded.option_a,
    option_b = excluded.option_b,
    option_c = excluded.option_c,
    option_d = excluded.option_d,
    option_e = excluded.option_e,
    correct_answer = excluded.correct_answer,
    score_weight = excluded.score_weight,
    explanation = excluded.explanation,
    order_number = excluded.order_number;

commit;
