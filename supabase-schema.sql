-- MEM College database schema for Supabase
-- Run this entire file in Supabase > SQL Editor.
-- IMPORTANT: After creating your account, promote YOUR account to admin manually
-- using the final SQL statement below. Do not expose the service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  role text not null default 'student' check (role in ('student','teacher','admin')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  instructions text not null default '',
  department text not null check (department in ('CS','SWE','CYBER','AI')),
  stage int not null check (stage between 1 and 4),
  storage_path text not null unique,
  teacher_id uuid not null references public.profiles(id),
  teacher_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 3000),
  department text not null check (department in ('CS','SWE','CYBER','AI')),
  stage int not null check (stage between 1 and 4),
  teacher_id uuid not null references public.profiles(id),
  teacher_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  student_name text not null,
  body text not null check (char_length(body) between 1 and 3000),
  status text not null default 'جديد' check (status in ('جديد','قيد المراجعة','تم الحل')),
  created_at timestamptz not null default now()
);

-- Create profile on signup. User-selected role is only a request; never trust it for teacher/admin privileges.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text;
  chosen_name text;
begin
  requested := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'مستخدم جديد');
  insert into public.profiles (id, full_name, role, approved)
  values (
    new.id,
    left(chosen_name, 100),
    case when requested = 'teacher' then 'teacher' else 'student' end,
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.approved = true
  );
$$;

create or replace function public.is_approved_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'teacher' and p.approved = true
  );
$$;

create or replace function public.approve_teacher(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve teachers';
  end if;
  update public.profiles set approved = true
  where id = target_user_id and role = 'teacher';
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved_teacher() to authenticated;
grant execute on function public.approve_teacher(uuid) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.lectures enable row level security;
alter table public.teacher_notes enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Admin can update profiles" on public.profiles;
create policy "Admin can update profiles" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users read lectures" on public.lectures;
create policy "Authenticated users read lectures" on public.lectures
for select to authenticated using (true);

drop policy if exists "Approved teachers insert lectures" on public.lectures;
create policy "Approved teachers insert lectures" on public.lectures
for insert to authenticated with check (public.is_approved_teacher() and teacher_id = (select auth.uid()));

drop policy if exists "Teacher owner or admin update lectures" on public.lectures;
create policy "Teacher owner or admin update lectures" on public.lectures
for update to authenticated using ((teacher_id = (select auth.uid()) and public.is_approved_teacher()) or public.is_admin())
with check ((teacher_id = (select auth.uid()) and public.is_approved_teacher()) or public.is_admin());

drop policy if exists "Teacher owner or admin delete lectures" on public.lectures;
create policy "Teacher owner or admin delete lectures" on public.lectures
for delete to authenticated using ((teacher_id = (select auth.uid()) and public.is_approved_teacher()) or public.is_admin());

drop policy if exists "Authenticated users read notes" on public.teacher_notes;
create policy "Authenticated users read notes" on public.teacher_notes
for select to authenticated using (true);

drop policy if exists "Approved teachers insert notes" on public.teacher_notes;
create policy "Approved teachers insert notes" on public.teacher_notes
for insert to authenticated with check (public.is_approved_teacher() and teacher_id = (select auth.uid()));

drop policy if exists "Teacher owner or admin update notes" on public.teacher_notes;
create policy "Teacher owner or admin update notes" on public.teacher_notes
for update to authenticated using ((teacher_id = (select auth.uid()) and public.is_approved_teacher()) or public.is_admin())
with check ((teacher_id = (select auth.uid()) and public.is_approved_teacher()) or public.is_admin());

drop policy if exists "Teacher owner or admin delete notes" on public.teacher_notes;
create policy "Teacher owner or admin delete notes" on public.teacher_notes
for delete to authenticated using ((teacher_id = (select auth.uid()) and public.is_approved_teacher()) or public.is_admin());

drop policy if exists "Students insert reports" on public.reports;
create policy "Students insert reports" on public.reports
for insert to authenticated with check (
  student_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'
  )
);

drop policy if exists "Admin read reports" on public.reports;
create policy "Admin read reports" on public.reports
for select to authenticated using (public.is_admin());

drop policy if exists "Admin update reports" on public.reports;
create policy "Admin update reports" on public.reports
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for PDFs. Private bucket: app generates short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lecture-pdfs', 'lecture-pdfs', false, 15728640, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = array['application/pdf'];

drop policy if exists "Approved teachers upload own PDFs" on storage.objects;
create policy "Approved teachers upload own PDFs" on storage.objects
for insert to authenticated with check (
  bucket_id = 'lecture-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_approved_teacher()
);

drop policy if exists "Authenticated users read lecture PDFs" on storage.objects;
create policy "Authenticated users read lecture PDFs" on storage.objects
for select to authenticated using (
  bucket_id = 'lecture-pdfs'
  and (
    public.is_admin()
    or public.is_approved_teacher()
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student')
  )
);

drop policy if exists "Owners or admins delete PDFs" on storage.objects;
create policy "Owners or admins delete PDFs" on storage.objects
for delete to authenticated using (
  bucket_id = 'lecture-pdfs'
  and (
    public.is_admin()
    or ((storage.foldername(name))[1] = (select auth.uid())::text and public.is_approved_teacher())
  )
);

-- After registering your own account and confirming the email, run this separately.
-- Replace YOUR_EMAIL with your exact login email. This promotes only that account to admin.
-- update public.profiles p
-- set role = 'admin', approved = true
-- from auth.users u
-- where p.id = u.id and lower(u.email) = lower('YOUR_EMAIL');
