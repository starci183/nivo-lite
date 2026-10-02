-- Module registry (DB side). The source of truth is resources/modules/<key>/module.json; scripts/seed-modules.mjs (npm run seed:modules) mirrors it here.
--   modules            one row per module key (replaces every CHECK that pinned 'chatbot' | 'sales' | 'accounting')
--   authority_actions  one row per authority action, owned by one module (replaces the authority_rules.action CHECK list)
-- The rows below only bootstrap the keys that already exist so the foreign keys can be added in this same migration; the seed script fills in the full definition.
-- A module added later is a module.json + `npm run seed:modules`: no migration touches these tables again.

create table public.modules (
  key text primary key check (key ~ '^[a-z][a-z0-9]{1,23}$'),
  sort_order int not null default 0,
  status text not null default 'early' check (status in ('stable', 'early')),
  category text not null,
  audience text not null default 'internal' check (audience in ('customer', 'internal')),
  knowledge_folder text not null,
  workbench text,
  default_operating_mode text not null default 'assist' check (default_operating_mode in ('assist', 'autopilot')),
  definition jsonb not null default '{}'::jsonb,   -- the whole module.json (names, copy, icon, mascot, gates, requires...)
  updated_at timestamptz not null default now()
);

create table public.authority_actions (
  action text primary key check (action ~ '^[a-z][a-z0-9_]{2,40}$'),
  module_key text not null references public.modules (key) on update cascade,
  sort_order int not null default 0,
  default_mode text not null default 'ask' check (default_mode in ('auto', 'ask', 'never')),
  default_limit_vnd bigint check (default_limit_vnd is null or default_limit_vnd >= 0),
  default_required_fields text[] not null default '{}',
  amount_limit boolean not null default false,       -- a VND limit is meaningful for this action
  max_mode text check (max_mode in ('ask', 'never')),  -- set = the action can never run alone (publish a video or a post)
  label jsonb not null default '{}'::jsonb,           -- {"vi": "...", "en": "..."}
  unique (module_key, action)
);
create index authority_actions_module on public.authority_actions (module_key, sort_order);

alter table public.modules enable row level security;
alter table public.authority_actions enable row level security;
create policy modules_read on public.modules for select to authenticated using (true);
create policy authority_actions_read on public.authority_actions for select to authenticated using (true);
revoke all on public.modules, public.authority_actions from anon, authenticated;
grant select on public.modules, public.authority_actions to authenticated;
grant all on public.modules, public.authority_actions to service_role;

-- Bootstrap rows (the ten modules of the registry and their actions).
insert into public.modules (key, sort_order, status, category, audience, knowledge_folder, workbench, default_operating_mode) values
  ('chatbot', 10, 'stable', 'sales_customer', 'customer', 'chatbot', 'chatbot', 'assist'),
  ('sales', 20, 'stable', 'sales_customer', 'internal', 'sales', 'sales', 'assist'),
  ('accounting', 30, 'stable', 'finance', 'internal', 'accounting', 'accounting', 'assist'),
  ('shifts', 40, 'early', 'operations', 'internal', 'shifts', null, 'assist'),
  ('booking', 50, 'early', 'operations', 'customer', 'booking', null, 'assist'),
  ('inventory', 60, 'early', 'operations', 'internal', 'inventory', null, 'assist'),
  ('loyalty', 70, 'early', 'sales_customer', 'customer', 'loyalty', null, 'assist'),
  ('video', 80, 'early', 'marketing', 'internal', 'video', null, 'assist'),
  ('content', 90, 'early', 'marketing', 'internal', 'content', null, 'assist'),
  ('hiring', 100, 'early', 'hr', 'internal', 'hiring', null, 'assist')
on conflict (key) do nothing;

insert into public.authority_actions (action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode, label) values
  ('reply_customer', 'chatbot', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Trả lời khách","en":"Reply to customer"}'::jsonb),
  ('handoff_lead', 'chatbot', 1, 'auto', null, array['contact_name', 'need']::text[], false, null, '{"vi":"Chuyển lead","en":"Hand off lead"}'::jsonb),
  ('classify_lead', 'sales', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Phân loại","en":"Classify lead"}'::jsonb),
  ('send_follow_up', 'sales', 1, 'ask', null, array['contact']::text[], false, null, '{"vi":"Gửi theo dõi","en":"Send follow-up"}'::jsonb),
  ('send_quote', 'sales', 2, 'ask', null, array['amount_vnd']::text[], true, null, '{"vi":"Gửi báo giá","en":"Send quote"}'::jsonb),
  ('confirm_order', 'sales', 3, 'auto', 20000000, array['customer', 'items', 'amount_vnd']::text[], true, null, '{"vi":"Xác nhận đơn hàng","en":"Confirm order"}'::jsonb),
  ('send_care', 'sales', 4, 'auto', null, array[]::text[], false, null, '{"vi":"Gửi chăm sóc","en":"Send customer care"}'::jsonb),
  ('issue_invoice', 'accounting', 0, 'auto', 20000000, array['customer', 'amount_vnd']::text[], true, null, '{"vi":"Xuất hóa đơn","en":"Issue invoice"}'::jsonb),
  ('reconcile_payment', 'accounting', 1, 'auto', 50000000, array['amount_vnd']::text[], true, null, '{"vi":"Đối soát thanh toán","en":"Reconcile payment"}'::jsonb),
  ('send_email', 'accounting', 2, 'ask', null, array['contact']::text[], false, null, '{"vi":"Gửi email cho khách","en":"Send email to a customer"}'::jsonb),
  ('publish_schedule', 'shifts', 0, 'ask', null, array[]::text[], false, null, '{"vi":"Đăng lịch ca","en":"Publish schedule"}'::jsonb),
  ('approve_swap', 'shifts', 1, 'auto', null, array[]::text[], false, null, '{"vi":"Duyệt đổi ca","en":"Approve shift swap"}'::jsonb),
  ('approve_leave', 'shifts', 2, 'ask', null, array[]::text[], false, null, '{"vi":"Duyệt xin nghỉ","en":"Approve leave"}'::jsonb),
  ('remind_shift', 'shifts', 3, 'auto', null, array[]::text[], false, null, '{"vi":"Nhắc ca làm","en":"Remind staff of a shift"}'::jsonb),
  ('confirm_booking', 'booking', 0, 'auto', null, array['contact']::text[], false, null, '{"vi":"Xác nhận lịch hẹn","en":"Confirm booking"}'::jsonb),
  ('reschedule', 'booking', 1, 'auto', null, array[]::text[], false, null, '{"vi":"Đổi lịch hẹn","en":"Reschedule"}'::jsonb),
  ('cancel_with_fee', 'booking', 2, 'ask', null, array[]::text[], true, null, '{"vi":"Hủy lịch có thu phí","en":"Cancel with a fee"}'::jsonb),
  ('remind_booking', 'booking', 3, 'auto', null, array[]::text[], false, null, '{"vi":"Nhắc lịch hẹn","en":"Remind about a booking"}'::jsonb),
  ('draft_purchase_order', 'inventory', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Soạn đơn nhập hàng","en":"Draft a purchase order"}'::jsonb),
  ('send_purchase_order', 'inventory', 1, 'ask', null, array['amount_vnd']::text[], true, null, '{"vi":"Gửi đơn nhập cho nhà cung cấp","en":"Send a purchase order"}'::jsonb),
  ('adjust_stock', 'inventory', 2, 'ask', null, array[]::text[], false, null, '{"vi":"Chỉnh số tồn kho","en":"Adjust stock"}'::jsonb),
  ('award_points', 'loyalty', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Cộng điểm","en":"Award points"}'::jsonb),
  ('redeem_reward', 'loyalty', 1, 'auto', 500000, array[]::text[], true, null, '{"vi":"Đổi quà","en":"Redeem a reward"}'::jsonb),
  ('send_promo', 'loyalty', 2, 'ask', null, array['contact']::text[], false, null, '{"vi":"Gửi khuyến mãi","en":"Send a promotion"}'::jsonb),
  ('render_draft', 'video', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Dựng bản nháp video","en":"Render a draft video"}'::jsonb),
  ('publish_video', 'video', 1, 'ask', null, array[]::text[], false, 'ask', '{"vi":"Đăng video","en":"Publish a video"}'::jsonb),
  ('draft_post', 'content', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Soạn bài đăng","en":"Draft a post"}'::jsonb),
  ('publish_post', 'content', 1, 'ask', null, array[]::text[], false, 'ask', '{"vi":"Đăng bài","en":"Publish a post"}'::jsonb),
  ('screen_candidate', 'hiring', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Sàng lọc ứng viên","en":"Screen a candidate"}'::jsonb),
  ('schedule_interview', 'hiring', 1, 'auto', null, array['contact']::text[], false, null, '{"vi":"Xếp lịch phỏng vấn","en":"Schedule an interview"}'::jsonb),
  ('send_offer', 'hiring', 2, 'ask', null, array['contact']::text[], false, null, '{"vi":"Gửi thư mời nhận việc","en":"Send a job offer"}'::jsonb)
on conflict (action) do nothing;

-- Drop every CHECK that pins a module or department key (found by definition, whatever the constraint is called).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'c' and n.nspname = 'public'
       and (
         (t.relname = 'agents' and pg_get_constraintdef(c.oid) like '%module%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
         or (t.relname = 'authority_rules' and (pg_get_constraintdef(c.oid) like '%department%' or pg_get_constraintdef(c.oid) like '%reply_customer%') and (pg_get_constraintdef(c.oid) like '%''chatbot''%' or pg_get_constraintdef(c.oid) like '%reply_customer%'))
         or (t.relname = 'work_items' and pg_get_constraintdef(c.oid) like '%department%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
         or (t.relname = 'module_installations' and pg_get_constraintdef(c.oid) like '%module_key%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
         or (t.relname = 'nivo_knowledge' and pg_get_constraintdef(c.oid) like '%module%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
         or (t.relname = 'knowledge_sources' and pg_get_constraintdef(c.oid) like '%module%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
         or (t.relname = 'knowledge_chunks' and pg_get_constraintdef(c.oid) like '%module%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
         or (t.relname = 'automation_pipelines' and pg_get_constraintdef(c.oid) like '%module_key%' and pg_get_constraintdef(c.oid) like '%''chatbot''%')
       )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Foreign keys to the registry. NIVO base knowledge also has the shared 'core' folder, so it only checks the key format.
alter table public.agents add constraint agents_module_fk foreign key (module) references public.modules (key) on update cascade;
alter table public.module_installations add constraint module_installations_module_key_fk foreign key (module_key) references public.modules (key) on update cascade;
alter table public.authority_rules add constraint authority_rules_department_fk foreign key (department) references public.modules (key) on update cascade;
alter table public.authority_rules add constraint authority_rules_action_fk foreign key (department, action) references public.authority_actions (module_key, action) on update cascade;
alter table public.work_items add constraint work_items_department_fk foreign key (department) references public.modules (key) on update cascade;
alter table public.knowledge_sources add constraint knowledge_sources_module_fk foreign key (module) references public.modules (key) on update cascade;
alter table public.knowledge_chunks add constraint knowledge_chunks_module_fk foreign key (module) references public.modules (key) on update cascade;
alter table public.automation_pipelines add constraint automation_pipelines_module_key_fk foreign key (module_key) references public.modules (key) on update cascade;
alter table public.nivo_knowledge add constraint nivo_knowledge_module_format check (module = 'core' or module ~ '^[a-z][a-z0-9]{1,23}$');
