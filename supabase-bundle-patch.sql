create table if not exists public.exam_bundles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  bundle_type text not null default 'uts',
  academic_year text not null,
  semester text not null default 'gasal',
  description text,
  status text not null default 'draft',
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  constraint exam_bundles_type_check check (bundle_type in ('uts', 'uas', 'pat', 'pas', 'tryout', 'custom')),
  constraint exam_bundles_semester_check check (semester in ('gasal', 'genap')),
  constraint exam_bundles_status_check check (status in ('draft', 'published', 'inactive'))
);

alter table public.exams
  add column if not exists bundle_id uuid references public.exam_bundles(id) on delete cascade;

create table if not exists public.exam_bundle_students (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.exam_bundles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint exam_bundle_students_unique unique (bundle_id, student_id)
);

create index if not exists idx_exam_bundles_school_id on public.exam_bundles(school_id);
create index if not exists idx_exams_bundle_id on public.exams(bundle_id);
create index if not exists idx_exam_bundle_students_bundle_id on public.exam_bundle_students(bundle_id);
create index if not exists idx_exam_bundle_students_student_id on public.exam_bundle_students(student_id);

alter table public.exam_bundles enable row level security;
alter table public.exam_bundle_students enable row level security;

drop policy if exists exam_bundles_owner_all on public.exam_bundles;
create policy exam_bundles_owner_all on public.exam_bundles
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists exam_bundles_admin_school on public.exam_bundles;
create policy exam_bundles_admin_school on public.exam_bundles
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists exam_bundles_guru_select_school on public.exam_bundles;
create policy exam_bundles_guru_select_school on public.exam_bundles
for select using (
  public.is_active_account()
  and public.current_role() = 'guru'
  and school_id = public.current_school_id()
  and exists (
    select 1 from public.exams e
    where e.bundle_id = exam_bundles.id
      and e.teacher_id = auth.uid()
  )
);

drop policy if exists exam_bundle_students_owner_all on public.exam_bundle_students;
create policy exam_bundle_students_owner_all on public.exam_bundle_students
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists exam_bundle_students_admin_school on public.exam_bundle_students;
create policy exam_bundle_students_admin_school on public.exam_bundle_students
for all using (
  public.is_active_account()
  and public.current_role() = 'admin'
  and exists (
    select 1 from public.exam_bundles b
    where b.id = exam_bundle_students.bundle_id
      and b.school_id = public.current_school_id()
  )
)
with check (
  public.is_active_account()
  and public.current_role() = 'admin'
  and exists (
    select 1 from public.exam_bundles b
    where b.id = exam_bundle_students.bundle_id
      and b.school_id = public.current_school_id()
  )
);

drop policy if exists exam_bundle_students_siswa_select_own on public.exam_bundle_students;
create policy exam_bundle_students_siswa_select_own on public.exam_bundle_students
for select using (
  public.is_active_account()
  and public.current_role() = 'siswa'
  and student_id = auth.uid()
);
