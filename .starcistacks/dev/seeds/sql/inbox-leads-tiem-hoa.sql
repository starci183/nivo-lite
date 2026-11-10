-- The customers of the demo flower shop "Tiệm hoa Nắng Mai" for the lead-centric Đầu vào page: seven fictional people and one unmatched transfer, across
-- Zalo, the website form, the website chat, Facebook, Telegram and the bank. Every row has a fixed id or a fixed dedupe key, so a rerun writes the same
-- rows again and adds nothing. The phones are fictional (0900 000 xxx), the names are made up, nothing here is a real person.
-- Order of the writes: leads and orders (the records of the entity engine), then the inputs, then the work the agents did or wait on.

-- Leads: the Sales agent owns them (its id is found by module, and a workspace without one leaves the owner empty).
WITH w AS (SELECT id FROM public.workspaces WHERE name = 'NIVO' ORDER BY created_at LIMIT 1),
     s AS (SELECT id FROM public.agents WHERE workspace_id = (SELECT id FROM w) AND module = 'sales' ORDER BY created_at LIMIT 1)
INSERT INTO public.records (id, workspace_id, entity, data, created_at, updated_at)
SELECT v.id::uuid, w.id, 'sales.lead', v.data::jsonb || jsonb_build_object('owner', (SELECT id::text FROM s)), now() - v.age, now() - v.age
FROM w CROSS JOIN (VALUES
    ('0b5e0000-0000-4000-8000-000000000001', $j${"contactName":"Trần Cẩm","channel":"website","stage":"new","phone":"84900000101","need":"Hai bó hồng mini, giao 7h sáng mai","contextSummary":"Khách muốn 2 bó hồng mini, giao 7h sáng mai tới 12 Lê Lợi, Q.1. Ghi thiệp: “Chúc mừng 8/3”. Khách để lại số điện thoại, chưa nhắn Zalo.","nextStep":"7:00 ngày 10/11 · 12 Lê Lợi, Q.1","quoteVnd":4000,"note":"Thiệp “Chúc mừng 8/3”"}$j$, interval '2 minutes'),
    ('0b5e0000-0000-4000-8000-000000000002', $j${"contactName":"Tự Cường","channel":"zalo","stage":"proposal","phone":"84900000102","need":"Một giỏ hoa nhỏ giao 25 Nguyễn Huệ","contextSummary":"Khách đặt 1 giỏ hoa nhỏ giao tới 25 Nguyễn Huệ. Đã gửi mã QR 2.000 ₫, đang chờ khách chuyển khoản.","nextStep":"Giao trong ngày · 25 Nguyễn Huệ","quoteVnd":2000}$j$, interval '14 minutes'),
    ('0b5e0000-0000-4000-8000-000000000003', $j${"contactName":"Nguyễn Tuấn Nam","channel":"zalo","stage":"qualified","phone":"84900000103","need":"Tư vấn nền tảng NIVO OS cho chuỗi 3 cửa hàng","contextSummary":"Chủ chuỗi 3 cửa hàng hỏi về nền tảng NIVO OS. Agent không báo giá được, cần bạn nhận khách này."}$j$, interval '1 hour'),
    ('0b5e0000-0000-4000-8000-000000000004', $j${"contactName":"Lê Hà","channel":"website","stage":"qualified","need":"Hoa cưới, ngân sách 3 đến 5 triệu","contextSummary":"Khách chat trên website hỏi giá hoa cưới, ngân sách 3 đến 5 triệu. Agent đang gửi bảng giá và hỏi ngày cưới."}$j$, interval '2 hours'),
    ('0b5e0000-0000-4000-8000-000000000005', $j${"contactName":"Dinhbui","channel":"zalo","stage":"won","phone":"84900000104","need":"Một chậu hoa giao tới Q.3","contextSummary":"Khách đặt 1 chậu hoa giao tới Q.3 và đã chuyển 5.000 ₫.","quoteVnd":5000}$j$, interval '26 hours'),
    ('0b5e0000-0000-4000-8000-000000000006', $j${"contactName":"Phạm My","channel":"facebook","stage":"new","need":"Xin bảng giá hoa 8/3","contextSummary":"Khách bình luận dưới quảng cáo “Hoa 8/3” xin bảng giá."}$j$, interval '27 hours'),
    ('0b5e0000-0000-4000-8000-000000000007', $j${"contactName":"Vũ An","channel":"telegram","stage":"lost","need":"Hỏi giờ mở cửa","contextSummary":"Khách hỏi giờ mở cửa, agent đã trả lời từ Second Brain.","closedReason":"Chỉ hỏi giờ mở cửa"}$j$, interval '2 days')
) AS v(id, data, age)
ON CONFLICT (entity, id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at;

-- Orders: a draft that waits for the owner, a confirmed one that waits for its money, and a paid one.
WITH w AS (SELECT id FROM public.workspaces WHERE name = 'NIVO' ORDER BY created_at LIMIT 1)
INSERT INTO public.records (id, workspace_id, entity, data, created_at, updated_at)
SELECT v.id::uuid, w.id, 'sales.order', v.data::jsonb, now() - v.age, now() - v.age
FROM w CROSS JOIN (VALUES
    ('0b5e0000-0000-4000-8000-0000000000a1', $j${"orderNo":"DH-20261109-9001","leadId":"0b5e0000-0000-4000-8000-000000000001","status":"draft","amountVnd":4000,"items":{"lines":[{"name":"Bó hồng mini","qty":2,"unitVnd":2000,"amountVnd":4000}]},"itemsText":"Bó hồng mini × 2 · 2.000 ₫ / bó","note":"Thiệp “Chúc mừng 8/3”"}$j$, interval '2 minutes'),
    ('0b5e0000-0000-4000-8000-0000000000a2', $j${"orderNo":"DH-20261109-9002","leadId":"0b5e0000-0000-4000-8000-000000000002","status":"confirmed","amountVnd":2000,"items":{"lines":[{"name":"Giỏ hoa nhỏ","qty":1,"unitVnd":2000,"amountVnd":2000}]},"itemsText":"Giỏ hoa nhỏ × 1","note":"Giao 25 Nguyễn Huệ"}$j$, interval '13 minutes'),
    ('0b5e0000-0000-4000-8000-0000000000a3', $j${"orderNo":"DH-20261108-9003","leadId":"0b5e0000-0000-4000-8000-000000000005","status":"paid","amountVnd":5000,"items":{"lines":[{"name":"Chậu hoa","qty":1,"unitVnd":5000,"amountVnd":5000}]},"itemsText":"Chậu hoa × 1","note":"Giao tới Q.3"}$j$, interval '25 hours')
) AS v(id, data, age)
ON CONFLICT (entity, id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at;

-- Inputs: one or two per customer, each with the channel it came in on, its customer key and where it came from; the unmatched transfer has no lead.
WITH w AS (SELECT id FROM public.workspaces WHERE name = 'NIVO' ORDER BY created_at LIMIT 1)
INSERT INTO public.inbound_events
    (workspace_id, channel, kind, sender_name, sender_contact, body, amount_vnd, external_ref, dedupe_key, event_id, lead_id, status, customer_key, source, created_at, updated_at)
SELECT w.id, v.channel, v.kind, v.sender_name, v.sender_contact, v.body, v.amount_vnd, v.external_ref, v.dedupe_key, v.dedupe_key, v.lead_id::uuid, v.status, v.customer_key, v.source::jsonb, now() - v.age, now() - v.age
FROM w CROSS JOIN (VALUES
    ('website', 'lead', 'Trần Cẩm', '84900000101', 'Form “Đặt hoa nhanh”: 2 bó hồng mini, giao 7h sáng mai, 12 Lê Lợi, Q.1.', NULL::bigint, NULL, 'seed:inbox:cam-form', '0b5e0000-0000-4000-8000-000000000001', 'needs_decision', 'phone:84900000101', '{"page":"/dat-hoa-nhanh","campaign":"Facebook · Hoa 8/3","device":"mobile"}', interval '2 minutes'),
    ('zalo', 'message', 'Tự Cường', NULL, 'Cho mình 1 giỏ hoa nhỏ giao 25 Nguyễn Huệ nhé', NULL, NULL, 'seed:inbox:cuong-1', '0b5e0000-0000-4000-8000-000000000002', 'processed', 'zalo:seed-cuong', '{}', interval '20 minutes'),
    ('zalo', 'message', 'Tự Cường', NULL, 'Cảm ơn shop, mình thanh toán ngay', NULL, NULL, 'seed:inbox:cuong-2', '0b5e0000-0000-4000-8000-000000000002', 'processed', 'zalo:seed-cuong', '{}', interval '14 minutes'),
    ('zalo', 'message', 'Nguyễn Tuấn Nam', NULL, 'Hỏi tư vấn nền tảng NIVO OS cho chuỗi 3 cửa hàng của mình', NULL, NULL, 'seed:inbox:nam-1', '0b5e0000-0000-4000-8000-000000000003', 'needs_decision', 'zalo:seed-nam', '{}', interval '1 hour'),
    ('website', 'message', 'Lê Hà', NULL, 'Hỏi giá hoa cưới, ngân sách 3–5 triệu', NULL, NULL, 'seed:inbox:ha-1', '0b5e0000-0000-4000-8000-000000000004', 'processed', 'web:seed-ha', '{"page":"/hoa-cuoi","device":"desktop"}', interval '2 hours'),
    ('zalo', 'message', 'Dinhbui', NULL, 'Cho mình một chậu hoa giao tới Q.3', NULL, NULL, 'seed:inbox:dinh-1', '0b5e0000-0000-4000-8000-000000000005', 'processed', 'zalo:seed-dinh', '{}', interval '26 hours'),
    ('bank', 'payment', 'Dinhbui', NULL, 'Chuyển khoản 5.000 ₫ cho đơn DH-20261108-9003', 5000, 'DH-20261108-9003', 'seed:inbox:dinh-pay', '0b5e0000-0000-4000-8000-000000000005', 'processed', NULL, '{}', interval '25 hours'),
    ('facebook', 'message', 'Phạm My', NULL, 'Bình luận quảng cáo “Hoa 8/3”: xin bảng giá', NULL, NULL, 'seed:inbox:my-1', '0b5e0000-0000-4000-8000-000000000006', 'processed', 'facebook:seed-my', '{"campaign":"Hoa 8/3","device":"mobile"}', interval '27 hours'),
    ('bank', 'payment', NULL, NULL, 'Chuyển khoản 1.080.000 ₫ · chưa khớp đơn nào', 1080000, NULL, 'seed:inbox:unmatched-1', NULL, 'needs_decision', NULL, '{}', interval '28 hours'),
    ('telegram', 'message', 'Vũ An', NULL, 'Mấy giờ shop mở cửa vậy?', NULL, NULL, 'seed:inbox:an-1', '0b5e0000-0000-4000-8000-000000000007', 'processed', 'telegram:seed-an', '{}', interval '2 days')
) AS v(channel, kind, sender_name, sender_contact, body, amount_vnd, external_ref, dedupe_key, lead_id, status, customer_key, source, age)
ON CONFLICT (workspace_id, dedupe_key) DO UPDATE SET
    lead_id = EXCLUDED.lead_id, body = EXCLUDED.body, status = EXCLUDED.status, customer_key = EXCLUDED.customer_key,
    source = EXCLUDED.source, sender_name = EXCLUDED.sender_name, sender_contact = EXCLUDED.sender_contact,
    amount_vnd = EXCLUDED.amount_vnd, external_ref = EXCLUDED.external_ref, created_at = EXCLUDED.created_at;

-- Work: two decisions that wait for the owner, and the replies the agents gave alone (they make the figures of the strip).
WITH w AS (SELECT id FROM public.workspaces WHERE name = 'NIVO' ORDER BY created_at LIMIT 1)
INSERT INTO public.work_items
    (workspace_id, department, action, subject_type, subject_id, lead_id, inbound_event_id, dedupe_key, status, decided_path, reason, created_at, completed_at)
SELECT w.id, v.department, v.action, 'lead', v.lead_id::uuid, v.lead_id::uuid,
       (SELECT e.id FROM public.inbound_events e WHERE e.workspace_id = w.id AND e.dedupe_key = v.event_key),
       v.dedupe_key, v.status, v.decided_path, v.reason, now() - v.age, CASE WHEN v.status = 'done' THEN now() - v.age + interval '40 seconds' END
FROM w CROSS JOIN (VALUES
    ('sales', 'confirm_order', '0b5e0000-0000-4000-8000-000000000001', 'seed:inbox:cam-form', 'seed:inbox:work-cam', 'waiting_decision', 'human', 'over_authority', interval '2 minutes'),
    ('chatbot', 'handoff_lead', '0b5e0000-0000-4000-8000-000000000003', 'seed:inbox:nam-1', 'seed:inbox:work-nam', 'waiting_decision', 'human', 'unclear_outcome', interval '1 hour'),
    ('sales', 'capture_lead', '0b5e0000-0000-4000-8000-000000000002', 'seed:inbox:cuong-1', 'seed:inbox:work-cuong', 'done', 'auto', 'routine', interval '20 minutes'),
    ('chatbot', 'reply_customer', '0b5e0000-0000-4000-8000-000000000004', 'seed:inbox:ha-1', 'seed:inbox:work-ha', 'done', 'auto', 'routine', interval '2 hours'),
    ('accounting', 'reconcile_payment', '0b5e0000-0000-4000-8000-000000000005', 'seed:inbox:dinh-pay', 'seed:inbox:work-dinh', 'done', 'auto', 'routine', interval '25 hours'),
    ('chatbot', 'reply_comment_public', '0b5e0000-0000-4000-8000-000000000006', 'seed:inbox:my-1', 'seed:inbox:work-my', 'done', 'auto', 'routine', interval '27 hours'),
    ('chatbot', 'reply_customer', '0b5e0000-0000-4000-8000-000000000007', 'seed:inbox:an-1', 'seed:inbox:work-an', 'done', 'auto', 'routine', interval '2 days')
) AS v(department, action, lead_id, event_key, dedupe_key, status, decided_path, reason, age)
ON CONFLICT (workspace_id, dedupe_key) DO UPDATE SET
    status = EXCLUDED.status, decided_path = EXCLUDED.decided_path, reason = EXCLUDED.reason, lead_id = EXCLUDED.lead_id,
    inbound_event_id = EXCLUDED.inbound_event_id, created_at = EXCLUDED.created_at, completed_at = EXCLUDED.completed_at;
