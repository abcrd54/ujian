-- =========================================================
-- SUPABASE SETUP - HYBRID AUTH/PROFILE FLOW
--
-- Flow:
-- 1. User dibuat di auth.users
-- 2. Trigger otomatis buat row di public.profiles
-- 3. Default profile: role='siswa', status='pending', school_id=null
-- 4. Owner/Admin approve dan set school_id + role final
--
-- Roles:
-- - owner : global / lintas sekolah
-- - admin : per sekolah
-- - guru  : per sekolah
-- - siswa : per sekolah
-- =========================================================

create extension if not exists pgcrypto;

-- =========================
-- SCHEMA
-- =========================

create table if not exists public.schools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text,
    npsn text unique,
    logo_url text,
    api_key text,
    status text not null default 'active',
    created_at timestamptz not null default now()
  );

alter table public.schools
  add column if not exists logo_url text;

create table if not exists public.profiles (
  id uuid primary key,
  school_id uuid references public.schools(id) on delete set null,
  full_name text not null,
  email text unique,
  phone text,
  role text not null default 'siswa',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on update cascade on delete set null,
  nip text,
  full_name text not null,
  email text,
  phone text,
  status text not null default 'active'
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  major text,
  grade text not null
);

create table if not exists public.students (
  id uuid primary key references public.profiles(id) on update cascade on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  nisn text,
  full_name text not null,
  username text,
  status text not null default 'active'
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on update cascade on delete set null,
  code text,
  name text not null,
  class_id uuid references public.classes(id) on delete set null
);

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

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  bundle_id uuid references public.exam_bundles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  teacher_id uuid references public.profiles(id) on update cascade on delete set null,
  title text not null,
  type text not null default 'mixed',
  duration_minutes int not null default 90,
  total_pg int not null default 0,
  total_essay int not null default 0,
  passing_grade int not null default 75,
  shuffle_questions boolean not null default false,
  shuffle_answers boolean not null default false,
  status text not null default 'draft',
  question_deadline timestamptz,
  created_at timestamptz not null default now()
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

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on update cascade on delete set null,
  question_type text not null,
  question_text text not null,
  image_url text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  correct_answer text,
  rubric_answer text,
  score_weight int not null default 1,
  explanation text,
  order_number int not null,
  created_at timestamptz not null default now(),
  constraint exam_questions_unique_order unique (exam_id, order_number),
  constraint exam_questions_type_check check (question_type in ('pg', 'essay'))
);

create table if not exists public.exam_schedules (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled',
  constraint exam_schedules_valid_time check (end_time > start_time)
);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  schedule_id uuid not null references public.exam_schedules(id) on delete cascade,
  started_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'started',
  final_score numeric(7,2) not null default 0,
  constraint exam_sessions_unique_student_schedule unique (exam_id, student_id, schedule_id)
);

create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answer_text text,
  selected_option text,
  is_correct boolean,
  score numeric(7,2) not null default 0,
  graded_by uuid references public.profiles(id) on update cascade on delete set null,
  graded_at timestamptz,
  constraint student_answers_session_question_unique unique (session_id, question_id)
);

create table if not exists public.api_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  endpoint text,
  method text,
  status_code int,
  ip_address text,
  created_at timestamptz not null default now()
);

-- =========================
-- PROFILE CONSTRAINTS
-- =========================

alter table public.profiles
  alter column school_id drop not null,
  alter column role set default 'siswa',
  alter column status set default 'pending';

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'guru', 'siswa'));

alter table public.profiles
  drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'active', 'inactive', 'blocked'));

alter table public.profiles
  drop constraint if exists profiles_school_required_check;
alter table public.profiles
  add constraint profiles_school_required_check
  check (
    status <> 'active'
    or role = 'owner'
    or school_id is not null
  );

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_profiles_school_id on public.profiles(school_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_teachers_school_id on public.teachers(school_id);
create index if not exists idx_students_school_id on public.students(school_id);
create index if not exists idx_students_class_id on public.students(class_id);
create unique index if not exists uq_students_school_nisn on public.students(school_id, nisn);
create unique index if not exists uq_students_school_username on public.students(school_id, username);
create index if not exists idx_classes_school_id on public.classes(school_id);
create index if not exists idx_subjects_school_id on public.subjects(school_id);
create unique index if not exists uq_subjects_school_code on public.subjects(school_id, code);
create index if not exists idx_exam_bundles_school_id on public.exam_bundles(school_id);
create index if not exists idx_exams_school_id on public.exams(school_id);
create index if not exists idx_exams_bundle_id on public.exams(bundle_id);
create index if not exists idx_exams_teacher_id on public.exams(teacher_id);
create index if not exists idx_exam_questions_exam_id on public.exam_questions(exam_id);
create index if not exists idx_exam_schedules_school_id on public.exam_schedules(school_id);
create index if not exists idx_exam_sessions_student_id on public.exam_sessions(student_id);
create index if not exists idx_exam_bundle_students_bundle_id on public.exam_bundle_students(bundle_id);
create index if not exists idx_exam_bundle_students_student_id on public.exam_bundle_students(student_id);
create index if not exists idx_student_answers_session_id on public.student_answers(session_id);
create index if not exists idx_api_logs_school_id on public.api_logs(school_id);

-- =========================
-- FK PATCH FOR EXISTING DB
-- memastikan perubahan profiles.id bisa cascade pada database lama
-- =========================

alter table public.teachers
  drop constraint if exists teachers_profile_id_fkey;
alter table public.teachers
  add constraint teachers_profile_id_fkey
  foreign key (profile_id) references public.profiles(id)
  on update cascade on delete set null;

alter table public.subjects
  drop constraint if exists subjects_teacher_id_fkey;
alter table public.subjects
  add constraint subjects_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id)
  on update cascade on delete set null;

alter table public.exams
  drop constraint if exists exams_teacher_id_fkey;
alter table public.exams
  add constraint exams_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id)
  on update cascade on delete set null;

alter table public.exam_questions
  drop constraint if exists exam_questions_teacher_id_fkey;
alter table public.exam_questions
  add constraint exam_questions_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id)
  on update cascade on delete set null;

alter table public.student_answers
  drop constraint if exists student_answers_graded_by_fkey;
alter table public.student_answers
  add constraint student_answers_graded_by_fkey
  foreign key (graded_by) references public.profiles(id)
  on update cascade on delete set null;

alter table public.students
  drop constraint if exists students_id_fkey;
alter table public.students
  add constraint students_id_fkey
  foreign key (id) references public.profiles(id)
  on update cascade on delete cascade;

-- =========================
-- HELPER FUNCTIONS
-- =========================

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'siswa');
$$;

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'owner';
$$;

create or replace function public.current_profile_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status from public.profiles where id = auth.uid()), 'pending');
$$;

create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_status() = 'active';
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated, anon, service_role;
revoke all on function public.current_school_id() from public;
grant execute on function public.current_school_id() to authenticated, anon, service_role;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated, anon, service_role;
revoke all on function public.current_profile_status() from public;
grant execute on function public.current_profile_status() to authenticated, anon, service_role;
revoke all on function public.is_active_account() from public;
grant execute on function public.is_active_account() to authenticated, anon, service_role;

-- =========================
-- HYBRID AUTH -> PROFILE TRIGGER
-- =========================

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id,
    school_id,
    full_name,
    email,
    phone,
    role,
    status,
    created_at
  )
  values (
    new.id,
    null,
    v_full_name,
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    'siswa',
    'pending',
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute procedure public.handle_new_user_profile();

update public.profiles p
set id = u.id
from auth.users u
where p.email is not null
  and u.email is not null
  and lower(p.email) = lower(u.email)
  and p.id <> u.id;

insert into public.profiles (id, school_id, full_name, email, role, status, created_at)
select
  u.id,
  null,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  'siswa',
  'pending',
  now()
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
     or (p.email is not null and u.email is not null and lower(p.email) = lower(u.email))
);

-- =========================
-- APPROVAL FUNCTION
-- owner: bisa set semua role/school
-- admin: hanya bisa set guru/siswa/admin di sekolahnya sendiri
-- =========================

create or replace function public.approve_profile_access(
  p_user_id uuid,
  p_school_id uuid,
  p_role text,
  p_status text default 'active'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me_role text;
  v_me_school uuid;
  v_result public.profiles;
begin
  v_me_role := public.current_role();
  v_me_school := public.current_school_id();

  if p_role not in ('owner', 'admin', 'guru', 'siswa') then
    raise exception 'Invalid role: %', p_role;
  end if;

  if p_status not in ('pending', 'active', 'inactive', 'blocked') then
    raise exception 'Invalid status: %', p_status;
  end if;

  if p_role <> 'owner' and p_status = 'active' and p_school_id is null then
    raise exception 'school_id wajib untuk role non-owner yang active';
  end if;

  if public.is_owner() then
    update public.profiles
    set school_id = p_school_id,
        role = p_role,
        status = p_status
    where id = p_user_id
    returning * into v_result;

    if v_result.id is null then
      raise exception 'Profile not found: %', p_user_id;
    end if;

    return v_result;
  end if;

  if v_me_role = 'admin' then
    if p_role = 'owner' then
      raise exception 'Admin cannot assign owner role';
    end if;

    if p_school_id is distinct from v_me_school then
      raise exception 'Admin can only assign users in own school';
    end if;

    update public.profiles
    set school_id = p_school_id,
        role = p_role,
        status = p_status
    where id = p_user_id
      and (school_id is null or school_id = v_me_school)
    returning * into v_result;

    if v_result.id is null then
      raise exception 'Profile not found / out of scope: %', p_user_id;
    end if;

    return v_result;
  end if;

  raise exception 'Forbidden';
end;
$$;

revoke all on function public.approve_profile_access(uuid, uuid, text, text) from public;
grant execute on function public.approve_profile_access(uuid, uuid, text, text) to authenticated, service_role;

-- =========================
-- ENABLE RLS
-- =========================

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.exam_bundles enable row level security;
alter table public.exams enable row level security;
alter table public.exam_bundle_students enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_schedules enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.student_answers enable row level security;
alter table public.api_logs enable row level security;

-- =========================
-- POLICIES
-- =========================

drop policy if exists schools_owner_all on public.schools;
create policy schools_owner_all on public.schools
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists schools_admin_select_own on public.schools;
create policy schools_admin_select_own on public.schools
for select using (public.current_role() = 'admin' and id = public.current_school_id());

drop policy if exists schools_admin_update_own on public.schools;
create policy schools_admin_update_own on public.schools
for update using (public.current_role() = 'admin' and id = public.current_school_id())
with check (public.current_role() = 'admin' and id = public.current_school_id());

drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all on public.profiles
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select using (id = auth.uid() and public.is_active_account());

drop policy if exists profiles_admin_select_school on public.profiles;
create policy profiles_admin_select_school on public.profiles
for select using (
  public.is_active_account()
  and
  public.current_role() = 'admin'
  and school_id = public.current_school_id()
);

drop policy if exists profiles_admin_write_school on public.profiles;
create policy profiles_admin_write_school on public.profiles
for update using (
  public.current_role() = 'admin'
  and (school_id = public.current_school_id() or school_id is null)
  and role in ('admin', 'guru', 'siswa')
)
with check (
  public.current_role() = 'admin'
  and school_id = public.current_school_id()
  and role in ('admin', 'guru', 'siswa')
);

drop policy if exists teachers_owner_all on public.teachers;
create policy teachers_owner_all on public.teachers
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists teachers_admin_school on public.teachers;
create policy teachers_admin_school on public.teachers
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists classes_owner_all on public.classes;
create policy classes_owner_all on public.classes
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists classes_admin_school on public.classes;
create policy classes_admin_school on public.classes
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists subjects_owner_all on public.subjects;
create policy subjects_owner_all on public.subjects
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists subjects_admin_school on public.subjects;
create policy subjects_admin_school on public.subjects
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists students_owner_all on public.students;
create policy students_owner_all on public.students
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists students_admin_school on public.students;
create policy students_admin_school on public.students
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists students_guru_select_school on public.students;
create policy students_guru_select_school on public.students
for select using (public.is_active_account() and public.current_role() = 'guru' and school_id = public.current_school_id());

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

drop policy if exists exams_owner_all on public.exams;
create policy exams_owner_all on public.exams
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists exams_admin_school on public.exams;
create policy exams_admin_school on public.exams
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists exams_guru_assigned on public.exams;
create policy exams_guru_assigned on public.exams
for select using (
  public.is_active_account()
  and
  public.current_role() = 'guru'
  and school_id = public.current_school_id()
  and teacher_id = auth.uid()
);

drop policy if exists exam_questions_owner_all on public.exam_questions;
create policy exam_questions_owner_all on public.exam_questions
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists exam_questions_admin_school on public.exam_questions;
create policy exam_questions_admin_school on public.exam_questions
for all using (
  public.is_active_account()
  and
  public.current_role() = 'admin'
  and exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.school_id = public.current_school_id()
  )
)
with check (
  public.is_active_account()
  and
  public.current_role() = 'admin'
  and exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.school_id = public.current_school_id()
  )
);

drop policy if exists exam_questions_guru_assigned on public.exam_questions;
create policy exam_questions_guru_assigned on public.exam_questions
for all using (
  public.is_active_account()
  and
  public.current_role() = 'guru'
  and exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.school_id = public.current_school_id()
      and e.teacher_id = auth.uid()
  )
)
with check (
  public.is_active_account()
  and
  public.current_role() = 'guru'
  and exists (
    select 1 from public.exams e
    where e.id = exam_questions.exam_id
      and e.school_id = public.current_school_id()
      and e.teacher_id = auth.uid()
  )
);

drop policy if exists exam_schedules_owner_all on public.exam_schedules;
create policy exam_schedules_owner_all on public.exam_schedules
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists exam_schedules_admin_school on public.exam_schedules;
create policy exam_schedules_admin_school on public.exam_schedules
for all using (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id())
with check (public.is_active_account() and public.current_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists exam_schedules_guru_select_school on public.exam_schedules;
create policy exam_schedules_guru_select_school on public.exam_schedules
for select using (public.is_active_account() and public.current_role() = 'guru' and school_id = public.current_school_id());

drop policy if exists exam_sessions_owner_all on public.exam_sessions;
create policy exam_sessions_owner_all on public.exam_sessions
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists exam_sessions_admin_guru_select on public.exam_sessions;
create policy exam_sessions_admin_guru_select on public.exam_sessions
for select using (
  public.is_active_account()
  and
  exists (
    select 1 from public.exams e
    where e.id = exam_sessions.exam_id
      and e.school_id = public.current_school_id()
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'guru' and e.teacher_id = auth.uid())
      )
  )
);

drop policy if exists exam_sessions_siswa_own on public.exam_sessions;
create policy exam_sessions_siswa_own on public.exam_sessions
for all using (
  public.is_active_account()
  and
  public.current_role() = 'siswa'
  and student_id = auth.uid()
)
with check (
  public.is_active_account()
  and
  public.current_role() = 'siswa'
  and student_id = auth.uid()
);

drop policy if exists student_answers_owner_all on public.student_answers;
create policy student_answers_owner_all on public.student_answers
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists student_answers_admin_guru_select on public.student_answers;
create policy student_answers_admin_guru_select on public.student_answers
for select using (
  public.is_active_account()
  and
  exists (
    select 1
    from public.exam_sessions s
    join public.exams e on e.id = s.exam_id
    where s.id = student_answers.session_id
      and e.school_id = public.current_school_id()
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'guru' and e.teacher_id = auth.uid())
      )
  )
);

drop policy if exists student_answers_admin_guru_update on public.student_answers;
create policy student_answers_admin_guru_update on public.student_answers
for update using (
  public.is_active_account()
  and
  exists (
    select 1
    from public.exam_sessions s
    join public.exams e on e.id = s.exam_id
    where s.id = student_answers.session_id
      and e.school_id = public.current_school_id()
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'guru' and e.teacher_id = auth.uid())
      )
  )
)
with check (
  public.is_active_account()
  and
  exists (
    select 1
    from public.exam_sessions s
    join public.exams e on e.id = s.exam_id
    where s.id = student_answers.session_id
      and e.school_id = public.current_school_id()
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'guru' and e.teacher_id = auth.uid())
      )
  )
);

drop policy if exists student_answers_siswa_own on public.student_answers;
create policy student_answers_siswa_own on public.student_answers
for all using (
  public.is_active_account()
  and
  public.current_role() = 'siswa'
  and student_id = auth.uid()
)
with check (
  public.is_active_account()
  and
  public.current_role() = 'siswa'
  and student_id = auth.uid()
);

drop policy if exists api_logs_owner_all on public.api_logs;
create policy api_logs_owner_all on public.api_logs
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists api_logs_admin_select on public.api_logs;
create policy api_logs_admin_select on public.api_logs
for select using (
  public.is_active_account()
  and
  public.current_role() = 'admin'
  and school_id = public.current_school_id()
);
