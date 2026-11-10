-- The demo Zalo conversation of the flower shop "Tiệm hoa Nắng Mai", so the inbox (Hộp thư) shows the media of a real sale without a live send: the customer asks for
-- pots, the shop answers with the album of three photos, the customer orders one, the shop sends the order card and the payment QR image (qr.sepay.vn, the URL format
-- viet-qr.policy builds), the customer says they paid, the shop confirms with the order marked paid.
--
-- Nothing here reaches a customer: the conversation is a seed one (the Zalo id is a placeholder, not a Zalo user, so no push is ever made to it) and the lines are written as
-- stored records. The customer is the fictional Dinhbui of inbox-leads-tiem-hoa.sql and the order is its paid order DH-20261108-9003. The photos are the catalogue photos the
-- dev API serves at /api/public/products/<item id>/image (the items come from catalogue.json); the bank account is fictional.
-- Fixed ids: a rerun writes the same rows again and adds nothing. Needs the workspace, the Chatbot and Sales agents, the catalogue and the leads of the other seeds.

-- The conversation.
WITH w AS (SELECT id FROM public.workspaces WHERE name = 'NIVO' ORDER BY created_at LIMIT 1),
     c AS (SELECT id FROM public.agents WHERE workspace_id = (SELECT id FROM w) AND module = 'chatbot' ORDER BY created_at LIMIT 1)
INSERT INTO public.records (id, workspace_id, entity, data, created_at, updated_at)
SELECT '0c0a0000-0000-4000-8000-000000000001'::uuid, w.id, 'chat.conversation',
       jsonb_build_object(
           'name', 'Dinhbui',
           'channel', 'zalo',
           'externalId', 'seed-demo-dinhbui',
           'status', 'ai',
           'waiting', false,
           'unanswered', false,
           'lastText', 'Shop đã nhận 5.000 ₫ cho đơn DH-20261108-9003. Cảm ơn bạn nhiều, hoa sẽ giao tới Q.3 trong hôm nay ạ.',
           'lastRole', 'agent',
           'lastAt', to_char((now() - interval '24 hours 20 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'messageCount', 6
       ) || CASE WHEN EXISTS (SELECT 1 FROM c) THEN jsonb_build_object('agentId', (SELECT id::text FROM c)) ELSE '{}'::jsonb END,
       now() - interval '25 hours', now() - interval '24 hours 20 minutes'
FROM w
ON CONFLICT (entity, id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at;

-- The conversation belongs to the customer.
INSERT INTO public.record_links (workspace_id, from_entity, from_id, relation, to_entity, to_id)
SELECT r.workspace_id, 'chat.conversation', r.id, 'lead', 'sales.lead', l.id
FROM public.records r
JOIN public.records l ON l.entity = 'sales.lead' AND l.id = '0b5e0000-0000-4000-8000-000000000005'::uuid AND l.workspace_id = r.workspace_id
WHERE r.entity = 'chat.conversation' AND r.id = '0c0a0000-0000-4000-8000-000000000001'::uuid
ON CONFLICT DO NOTHING;

-- The lines. Photo links: the public address of the catalogue item's photo, found by sku.
WITH w AS (SELECT id FROM public.workspaces WHERE name = 'NIVO' ORDER BY created_at LIMIT 1),
     s AS (SELECT id FROM public.agents WHERE workspace_id = (SELECT id FROM w) AND module = 'sales' ORDER BY created_at LIMIT 1),
     p AS (
         SELECT i.sku, i.name, 'http://localhost:18787/api/public/products/' || i.id::text || '/image' AS url
         FROM public.inventory_items i
         WHERE i.workspace_id = (SELECT id FROM w)
     ),
     qr AS (SELECT 'https://qr.sepay.vn/img?acc=0123456789&bank=MBBank&amount=5000&des=DH202611089003&template=compact' AS url),
     lines AS (
         SELECT * FROM (VALUES
             (1, 'user', 'Shop ơi cho mình xem vài mẫu chậu hoa với', interval '25 hours', NULL::jsonb, NULL::jsonb),
             (2, 'agent', E'Dạ shop gửi bạn vài mẫu chậu hoa đang được yêu thích ạ:\nChậu sen đá · 1.000 ₫\nLan hồ điệp mini · 4.500 ₫\nHộp hoa tulip · 4.000 ₫',
                 interval '24 hours 58 minutes',
                 jsonb_build_object('items', (
                     SELECT coalesce(jsonb_agg(jsonb_build_object('id', 'file-' || x.n::text, 'url', x.url, 'name', x.name, 'contentType', 'image/jpeg') ORDER BY x.n), '[]'::jsonb)
                     FROM (
                         SELECT 1 AS n, url, name FROM p WHERE sku = 'CHAU-SEN-DA'
                         UNION ALL SELECT 2, url, name FROM p WHERE sku = 'LAN-HO-DIEP-MINI'
                         UNION ALL SELECT 3, url, name FROM p WHERE sku = 'HOP-HOA-TULIP'
                     ) x
                 )),
                 NULL::jsonb),
             (3, 'user', 'Cho mình một chậu hoa, giao tới Q.3 nhé', interval '24 hours 50 minutes', NULL::jsonb, NULL::jsonb),
             (4, 'agent', E'Đơn của bạn đã được ghi nhận: 1 x Chậu hoa · 5.000 ₫.\nBạn chuyển khoản giúp shop theo thông tin này nhé:\nNgân hàng: MB Bank\nSố tài khoản: 0123456789\nNội dung chuyển khoản (gõ đúng): DH202611089003\nHoặc quét mã QR: https://qr.sepay.vn/img?acc=0123456789&bank=MBBank&amount=5000&des=DH202611089003&template=compact\nChuyển xong bạn nhắn shop ở đây nhé.',
                 interval '24 hours 48 minutes',
                 jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', 'file-1', 'url', (SELECT url FROM qr), 'name', 'DH202611089003', 'contentType', 'image/png'))),
                 jsonb_build_object(
                     'orderNo', 'DH-20261108-9003',
                     'lines', jsonb_build_array(jsonb_build_object(
                         'name', 'Chậu hoa', 'qty', 1, 'unitText', '5.000 ₫', 'amountText', '5.000 ₫',
                         'imageUrl', (SELECT url FROM p WHERE sku = 'CHAU-HOA')
                     )),
                     'amountText', '5.000 ₫', 'address', 'Q.3', 'paid', false)),
             (5, 'user', 'Mình chuyển khoản rồi nhé', interval '24 hours 30 minutes', NULL::jsonb, NULL::jsonb),
             (6, 'agent', 'Shop đã nhận 5.000 ₫ cho đơn DH-20261108-9003. Cảm ơn bạn nhiều, hoa sẽ giao tới Q.3 trong hôm nay ạ.',
                 interval '24 hours 20 minutes', NULL::jsonb,
                 jsonb_build_object(
                     'orderNo', 'DH-20261108-9003',
                     'lines', jsonb_build_array(jsonb_build_object(
                         'name', 'Chậu hoa', 'qty', 1, 'unitText', '5.000 ₫', 'amountText', '5.000 ₫',
                         'imageUrl', (SELECT url FROM p WHERE sku = 'CHAU-HOA')
                     )),
                     'amountText', '5.000 ₫', 'address', 'Q.3', 'paid', true))
         ) AS v(n, role, text, age, files, orderCard)
     )
INSERT INTO public.records (id, workspace_id, entity, data, created_at, updated_at)
SELECT ('0c0a0000-0000-4000-8000-0000000001' || lpad(l.n::text, 2, '0'))::uuid, (SELECT id FROM w), 'chat.message',
       jsonb_build_object(
           'conversationId', '0c0a0000-0000-4000-8000-000000000001',
           'role', l.role,
           'text', l.text,
           'sentAt', to_char((now() - l.age) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'status', 'posted',
           'channelRef', 'seed:demo-zalo:dinhbui:' || l.n::text
       )
       || CASE WHEN l.role = 'agent' THEN jsonb_build_object('authorKind', 'ai', 'deliveryStatus', 'sent') ELSE '{}'::jsonb END
       || CASE WHEN l.role = 'agent' AND EXISTS (SELECT 1 FROM s) THEN jsonb_build_object('sentBy', (SELECT id::text FROM s)) ELSE '{}'::jsonb END
       || CASE WHEN l.files IS NULL OR jsonb_array_length(l.files -> 'items') = 0 THEN '{}'::jsonb ELSE jsonb_build_object('files', l.files) END
       || CASE WHEN l.orderCard IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('orderCard', l.orderCard) END,
       now() - l.age, now() - l.age
FROM lines l
ON CONFLICT (entity, id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at;

-- Every line belongs to its conversation.
INSERT INTO public.record_links (workspace_id, from_entity, from_id, relation, to_entity, to_id)
SELECT m.workspace_id, 'chat.message', m.id, 'conversation', 'chat.conversation', '0c0a0000-0000-4000-8000-000000000001'::uuid
FROM public.records m
WHERE m.entity = 'chat.message' AND m.data ->> 'conversationId' = '0c0a0000-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;
