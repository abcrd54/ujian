# Dokumentasi Program Sistem Ujian Sekolah

## 1) Arsitektur Sistem

- Frontend: React + Vite + Tailwind (`src/*`) untuk dashboard admin/guru/siswa.
- Backend API: Express (`server/index.js`) untuk endpoint `/api/*`.
- Database/Auth/Storage: Supabase PostgreSQL, Supabase Auth, Supabase Storage.
- Deployment target:
  - Frontend ke Vercel.
  - Backend API ke server Node (atau Vercel serverless adaptasi route handler).
  - Database + Storage tetap di Supabase.

## 2) Struktur Folder Project

- `src/`
- `src/pages/` halaman login, dashboard, data master, ujian, sesi siswa, koreksi essay, settings.
- `src/components/` layout, table, cards.
- `src/auth/` Supabase Auth context dan role guard.
- `src/services/` service data ke Supabase.
- `src/ui/` modal konfirmasi dan toast.
- `server/`
- `server/index.js` backend endpoint utama.
- `server/middlewares.js` auth middleware, role middleware, API key middleware, rate limit, audit log.
- `server/supabaseAdmin.js` client Supabase admin/anon.
- `supabase-setup.sql` aktivasi RLS + policy per role.

## 3) Schema Database Supabase

Tabel yang dipakai:
- `schools`
- `profiles`
- `teachers`
- `students`
- `classes`
- `subjects`
- `exams`
- `exam_questions`
- `exam_schedules`
- `exam_sessions`
- `student_answers`
- `api_logs`

Skema detail mengikuti `panduan.txt`.

## 4) Flow Role Admin, Guru, Siswa

- Admin:
  - login, kelola sekolah/guru/siswa/kelas/mapel/ujian/jadwal.
  - review soal, approve soal, monitor hasil.
  - generate/regenerate API key.
- Guru:
  - login, lihat tugas soal, input soal, submit soal.
  - koreksi essay dan lihat hasil ujian mapel terkait.
- Siswa:
  - login, lihat sesi ujian (`/student-exams`), start sesi, isi jawaban, submit.

## 5) API Endpoint

Endpoint utama yang tersedia:
- `POST /api/auth/login`
- `POST /api/student/login`
- `GET /api/student/profile`
- `GET /api/dashboard`
- `GET /api/schools`
- `GET /api/teachers`
- `POST /api/teachers`
- `POST /api/teachers/import`
- `GET /api/students`
- `POST /api/students`
- `POST /api/students/import`
- `POST /api/students/generate-usernames`
- `POST /api/students/:id/reset-password`
- `GET /api/classes`
- `POST /api/classes`
- `GET /api/subjects`
- `POST /api/subjects`
- `GET /api/exams`
- `POST /api/exams`
- `GET /api/exams/:id`
- `POST /api/exams/:id/questions`
- `POST /api/exams/:id/upload-image`
- `POST /api/exams/:id/submit-questions`
- `POST /api/exams/:id/approve`
- `POST /api/exam-schedules`
- `GET /api/student/exams`
- `GET /api/student/exams/:examId`
- `POST /api/student/exam-sessions/start`
- `GET /api/student/exam-sessions/:sessionId/questions`
- `POST /api/student/answers/save`
- `POST /api/student/answers`
- `POST /api/student/exam-sessions/:sessionId/submit`
- `POST /api/student/exam-sessions/submit`
- `GET /api/student/results`
- `GET /api/student/results/:examId`
- `GET /api/results`
- `GET /api/results/export?format=csv|pdf`
- `POST /api/essay/grade`

## 6) Aturan Keamanan RLS

- RLS aktif di tabel inti (`profiles`, `teachers`, `students`, `classes`, `subjects`, `exams`, `exam_questions`, `exam_schedules`, `exam_sessions`, `student_answers`).
- Akses dibatasi dengan:
  - `school_id` user aktif.
  - role `admin`/`guru` untuk data sekolah.
  - role `siswa` hanya data sesi/jawaban miliknya.
- Endpoint siswa menggunakan JWT Supabase:
  - `Authorization: Bearer {ACCESS_TOKEN_SISWA}`
- Validasi server-side tambahan:
  - `question_id` wajib milik `exam_id` dari `session`.
  - detail ujian siswa wajib cocok `school_id` + `class_id`.
  - worker auto-submit background untuk session lewat batas waktu.
- API key sekolah tetap untuk integrasi eksternal tertentu:
  - `Authorization: Bearer {API_KEY}`
  - `X-School-ID: {SCHOOL_ID}`
- Rate limit aktif di endpoint publik/login.
- Audit log request API dicatat ke `api_logs`.

## 7) Desain UI Dashboard Modern Minimalis

- Sidebar kiri dan header sticky.
- Card statistik dan tabel clean.
- Search/filter pada tabel.
- Empty state dan loading skeleton.
- Modal konfirmasi.
- Toast notification.
- Form step-by-step untuk pembuatan ujian.
- Warna biru/putih/abu + font Inter.
- Responsive desktop dan tablet.

## 8) Roadmap MVP ke Production

MVP:
- Auth + role guard.
- CRUD data utama.
- workflow ujian (buat ujian, soal, jadwal, sesi siswa, submit, hasil).
- RLS + audit log.

Beta:
- Import Excel production-grade + validasi batch.
- Upload gambar soal dengan signed URL.
- Export nilai PDF/Excel layout resmi sekolah.
- notifikasi realtime tugas/review.

Production:
- monitoring + observability (error tracking, metrics).
- backup terjadwal + restore test.
- load test endpoint ujian.
- hardening security (WAF, rotated API key, secret management).
- CI/CD dengan test otomatis dan staging.
