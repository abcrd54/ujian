# SiapUjian Dashboard

Dashboard ujian sekolah berbasis React + Vite + Tailwind dengan Supabase Auth.

## Struktur Utama

- `src/components` layout dan komponen reusable.
- `src/pages` halaman per menu dashboard.
- `src/auth` context auth Supabase + route guard role.
- `src/services/dashboardService.js` service data ke API/Supabase.
- `src/lib/supabase.js` inisialisasi client Supabase.

## Setup

1. Install dependency:
   - `npm install`
2. Buat file `.env` dari `.env.example` lalu isi:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTO_SUBMIT_ENABLED`
   - `AUTO_SUBMIT_SWEEP_MS`
3. Pastikan user Auth punya row di tabel `profiles`:
   - `id` = `auth.users.id`
   - `full_name`
   - `role` = `admin` atau `guru` atau `siswa`
4. Login lewat halaman `/login` dengan akun Supabase Auth.
5. Build produksi:
   - `npm run build`
6. Jalankan API backend:
   - `npm run server`

## SQL Setup

- Jalankan [supabase-setup.sql](E:\Project\ujian\dashboard\supabase-setup.sql) di SQL Editor Supabase untuk mengaktifkan RLS dan policy role `admin/guru/siswa`.

## Catatan

- Role `admin`: akses dashboard dan menu manajemen penuh.
- Role `guru`: akses dashboard, data ujian, tugas guru, hasil ujian, pengaturan.
- Role `siswa`: ditolak di dashboard web, wajib menggunakan aplikasi siswa.
- Endpoint siswa backend kini menggunakan JWT Supabase (`Authorization: Bearer <access_token_siswa>`).
- Dokumentasi lengkap ada di [DOKUMENTASI.md](E:\Project\ujian\dashboard\DOKUMENTASI.md).
