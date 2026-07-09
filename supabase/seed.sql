-- Demo seed data (idempotent-ish: run once on a fresh project)

with anna as (
  insert into clients (name, phone, status, comment, case_type, priority, created_at, updated_at)
  values ('Анна Смирнова', '+7 916 234-56-78', 'new',
          'Первичная консультация по трудовому спору', 'Консультация', 'medium',
          '2026-07-06T10:00:00Z', '2026-07-06T10:00:00Z')
  returning id
), mikhail as (
  insert into clients (name, phone, status, comment, case_type, priority, created_at, updated_at)
  values ('Михаил Иванов', '+7 903 111-22-33', 'in_progress',
          'Договор на проверке', 'Договор', 'high',
          '2026-07-04T14:30:00Z', '2026-07-07T09:15:00Z')
  returning id
), alfa as (
  insert into clients (name, phone, status, comment, case_type, created_at, updated_at)
  values ('ООО «Альфа»', '+7 495 987-65-43', 'waiting_client',
          'Ждёт документы от бухгалтерии', 'Корпоративное',
          '2026-07-01T11:00:00Z', '2026-07-05T16:40:00Z')
  returning id
), sergey as (
  insert into clients (name, phone, status, case_type, created_at, updated_at)
  values ('Сергей Петров', '+7 921 555-44-33', 'closed', 'Суд',
          '2026-06-20T09:00:00Z', '2026-07-02T12:00:00Z')
  returning id
), hist as (
  insert into case_history (client_id, type, text, metadata, created_at)
  select id, 'client_created', 'Клиент добавлен', null::jsonb, '2026-07-06T10:00:00Z'::timestamptz from anna
  union all
  select id, 'client_created', 'Клиент добавлен', null::jsonb, '2026-07-04T14:30:00Z'::timestamptz from mikhail
  union all
  select id, 'note_added', 'Проведена первичная консультация, договор отправлен на проверку', null::jsonb, '2026-07-05T10:00:00Z'::timestamptz from mikhail
  union all
  select id, 'status_changed', 'Новый → В работе', '{"from":"new","to":"in_progress"}'::jsonb, '2026-07-05T10:05:00Z' from mikhail
  union all
  select id, 'client_created', 'Клиент добавлен', null::jsonb, '2026-07-01T11:00:00Z'::timestamptz from alfa
  union all
  select id, 'status_changed', 'В работе → Ожидает клиента', '{"from":"in_progress","to":"waiting_client"}'::jsonb, '2026-07-05T16:40:00Z' from alfa
  union all
  select id, 'client_created', 'Клиент добавлен', null::jsonb, '2026-06-20T09:00:00Z'::timestamptz from sergey
  union all
  select id, 'status_changed', 'В работе → Закрыт', '{"from":"in_progress","to":"closed"}'::jsonb, '2026-07-02T12:00:00Z' from sergey
  returning id
), t as (
  insert into tasks (client_id, title, due_date, created_at)
  select id, 'Отправить договор', '2026-07-10'::date, '2026-07-06T10:10:00Z'::timestamptz from anna
  union all
  select id, 'Запросить документы повторно', '2026-07-08'::date, '2026-07-05T16:45:00Z'::timestamptz from alfa
  returning id
)
insert into attachments (client_id, file_name, created_at)
select id, 'contract-draft.docx', '2026-07-05T10:20:00Z'::timestamptz from mikhail;
