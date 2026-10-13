-- Lead generation module (key lead_gen, "Tạo lead"). The source of truth is resources/modules/lead_gen/module.json; `npm run seed:modules` mirrors the full definition.
-- This migration (1) lets a module key contain an underscore and (2) bootstraps the module and its authority actions so a workspace can install it before the seed script runs.

-- 1. Module keys: lowercase ASCII, digits and underscore (was letters and digits only).
do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.modules'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%{1,23}%'
  loop
    execute format('alter table public.modules drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.modules add constraint modules_key_format check (key ~ '^[a-z][a-z0-9_]{1,23}$');

alter table public.nivo_knowledge drop constraint if exists nivo_knowledge_module_format;
alter table public.nivo_knowledge add constraint nivo_knowledge_module_format check (module = 'core' or module ~ '^[a-z][a-z0-9_]{1,23}$');

-- 2. The module and its actions.
insert into public.modules (key, sort_order, status, category, audience, knowledge_folder, workbench, default_operating_mode) values
  ('lead_gen', 15, 'early', 'sales_customer', 'customer', 'lead_gen', 'lead_gen', 'assist')
on conflict (key) do update set
  sort_order = excluded.sort_order, status = excluded.status, category = excluded.category, audience = excluded.audience,
  knowledge_folder = excluded.knowledge_folder, workbench = excluded.workbench, default_operating_mode = excluded.default_operating_mode;

insert into public.authority_actions (action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode, label) values
  ('capture_lead', 'lead_gen', 0, 'auto', null, array[]::text[], false, null, '{"vi":"Ghi nhận khách tiềm năng","en":"Capture lead"}'::jsonb),
  ('greet_prospect', 'lead_gen', 1, 'auto', null, array[]::text[], false, null, '{"vi":"Chào khách","en":"Greet prospect"}'::jsonb),
  ('ask_qualifying', 'lead_gen', 2, 'auto', null, array[]::text[], false, null, '{"vi":"Hỏi câu lọc khách","en":"Ask qualifying questions"}'::jsonb),
  ('score_lead', 'lead_gen', 3, 'auto', null, array[]::text[], false, null, '{"vi":"Chấm điểm khách","en":"Score lead"}'::jsonb),
  ('reply_comment_public', 'lead_gen', 4, 'auto', null, array[]::text[], false, null, '{"vi":"Trả lời bình luận công khai","en":"Reply to a public comment"}'::jsonb),
  ('private_reply_comment', 'lead_gen', 5, 'auto', null, array[]::text[], false, null, '{"vi":"Nhắn riêng cho người bình luận","en":"Private reply to a comment"}'::jsonb),
  ('send_lead_offer', 'lead_gen', 6, 'ask', null, array['contact']::text[], false, null, '{"vi":"Gửi ưu đãi cho khách","en":"Send an offer to a lead"}'::jsonb),
  ('quote_custom_price', 'lead_gen', 7, 'ask', null, array['amount_vnd']::text[], true, null, '{"vi":"Báo giá riêng","en":"Quote a custom price"}'::jsonb),
  ('handoff_to_sales', 'lead_gen', 8, 'auto', null, array['contact', 'need']::text[], false, null, '{"vi":"Chuyển khách nóng cho Sales","en":"Hand a hot lead to Sales"}'::jsonb),
  ('message_with_human_agent_tag', 'lead_gen', 9, 'ask', null, array['contact']::text[], false, 'ask', '{"vi":"Nhắn bằng thẻ nhân viên (ngoài 24 giờ)","en":"Message with the human agent tag"}'::jsonb),
  ('message_outside_window', 'lead_gen', 10, 'never', null, array[]::text[], false, 'never', '{"vi":"Nhắn ngoài khung 24 giờ","en":"Message outside the 24-hour window"}'::jsonb),
  ('hide_or_delete_comment', 'lead_gen', 11, 'never', null, array[]::text[], false, 'never', '{"vi":"Ẩn hoặc xóa bình luận của khách","en":"Hide or delete a customer comment"}'::jsonb)
on conflict (action) do update set
  module_key = excluded.module_key, sort_order = excluded.sort_order, default_mode = excluded.default_mode, default_limit_vnd = excluded.default_limit_vnd,
  default_required_fields = excluded.default_required_fields, amount_limit = excluded.amount_limit, max_mode = excluded.max_mode, label = excluded.label;
