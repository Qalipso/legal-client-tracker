-- v0.4: expand clients into a "matter" model + legal reference dictionaries
-- Decision: extend clients (not a parallel table) — fewer migrations, all
-- existing tasks/case_history/attachments/notification_* keep working as-is.

-- ── reference dictionaries (global, not user-owned) ─────────────────────
create table if not exists matter_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  sort_order int not null default 0
);
create table if not exists matter_stages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  sort_order int not null default 0
);
create table if not exists document_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  sort_order int not null default 0
);
create table if not exists document_statuses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  sort_order int not null default 0
);
create table if not exists deadline_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  sort_order int not null default 0
);

insert into matter_types (code, label, sort_order) values
  ('contract', 'Договор', 1),
  ('claim', 'Претензия', 2),
  ('litigation', 'Суд', 3),
  ('consultation', 'Консультация', 4),
  ('corporate', 'Корпоративное', 5),
  ('migration', 'Миграционное', 6)
on conflict (code) do nothing;

insert into matter_stages (code, label, sort_order) values
  ('intake', 'Новое обращение', 1),
  ('preparation', 'Подготовка документов', 2),
  ('sent', 'Направлено контрагенту', 3),
  ('review', 'На рассмотрении', 4),
  ('litigation', 'Судебное разбирательство', 5),
  ('enforcement', 'Исполнение решения', 6),
  ('closed', 'Завершено', 7)
on conflict (code) do nothing;

insert into document_types (code, label, sort_order) values
  ('contract', 'Договор', 1),
  ('claim', 'Претензия', 2),
  ('lawsuit', 'Исковое заявление', 3),
  ('power_of_attorney', 'Доверенность', 4),
  ('id_document', 'Паспорт / удостоверение', 5),
  ('court_act', 'Судебный акт', 6),
  ('correspondence', 'Переписка', 7),
  ('other', 'Прочее', 8)
on conflict (code) do nothing;

insert into document_statuses (code, label, sort_order) values
  ('draft', 'Черновик', 1),
  ('in_preparation', 'На подготовке', 2),
  ('sent', 'Отправлен', 3),
  ('signed', 'Подписан', 4),
  ('under_review', 'На проверке', 5),
  ('approved', 'Утверждён', 6),
  ('archived', 'Архив', 7)
on conflict (code) do nothing;

insert into deadline_types (code, label, sort_order) values
  ('procedural', 'Процессуальный срок', 1),
  ('claim_response', 'Срок ответа на претензию', 2),
  ('contract_performance', 'Срок исполнения договора', 3),
  ('payment', 'Срок оплаты', 4),
  ('internal', 'Внутренний дедлайн', 5)
on conflict (code) do nothing;

alter table matter_types enable row level security;
alter table matter_stages enable row level security;
alter table document_types enable row level security;
alter table document_statuses enable row level security;
alter table deadline_types enable row level security;
create policy "read dictionary" on matter_types for select using (true);
create policy "read dictionary" on matter_stages for select using (true);
create policy "read dictionary" on document_types for select using (true);
create policy "read dictionary" on document_statuses for select using (true);
create policy "read dictionary" on deadline_types for select using (true);

-- ── clients → matter fields ──────────────────────────────────────────────
-- case_type (freeform, v0.2) kept for backward compat with existing rows;
-- matter_type is the new dictionary-backed field going forward.
alter table clients add column if not exists matter_title text;
alter table clients add column if not exists matter_type text references matter_types(code);
alter table clients add column if not exists matter_subject text;
alter table clients add column if not exists stage text references matter_stages(code);
alter table clients add column if not exists counterparty text;
alter table clients add column if not exists key_deadline date;

-- ── documents: type + status on the existing attachments table ──────────
alter table attachments add column if not exists document_type text references document_types(code);
alter table attachments add column if not exists document_status text references document_statuses(code);

-- ── matter_deadlines: "Контрольные сроки" (distinct from tasks — these are
-- formal, typed legal deadlines, not ad-hoc next actions) ────────────────
create table if not exists matter_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  deadline_type text references deadline_types(code),
  title text not null,
  due_date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_matter_deadlines_client on matter_deadlines(client_id);
alter table matter_deadlines enable row level security;
create policy "own rows" on matter_deadlines for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── matter_risks: "Риски / открытые вопросы" ─────────────────────────────
create table if not exists matter_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  text text not null,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_matter_risks_client on matter_risks(client_id);
alter table matter_risks enable row level security;
create policy "own rows" on matter_risks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
