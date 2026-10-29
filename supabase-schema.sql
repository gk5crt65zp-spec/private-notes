-- =====================================================
-- مشروع: دفتر الملاحظات الخاص — Private Notes
-- قاعدة بيانات Supabase + تفعيل RLS
-- نفّذ هذا الملف كاملاً في: Supabase Dashboard ← SQL Editor ← Run
-- =====================================================

-- 1) إنشاء جدول الملاحظات
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  content     text not null default '',
  category    text not null default 'عام',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) تفعيل RLS (Row Level Security) — أهم خطوة
alter table public.notes enable row level security;

-- 3) سياسات الأمان: كل مستخدم يرى/يعدّل/يحذف ملاحظاته فقط
drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes for delete
  using (auth.uid() = user_id);

-- 4) دالة تحديث updated_at تلقائيًا
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();

-- 5) فهرس لتحسين الأداء حسب المستخدم
create index if not exists notes_user_id_idx on public.notes (user_id);
