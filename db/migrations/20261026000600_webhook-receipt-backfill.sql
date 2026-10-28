-- Restore jobs for receipts committed before deferred consumers were composed.
-- The outbox dedupe keys make this safe to repeat alongside live intake.
-- Legacy Telegram/Zalo rows without rawBody need operator recovery; see webhook-receipts.md.
-- Successful/completed receipts and existing outbox jobs are preserved.

SELECT public.job_enqueue(
    NULL::uuid, 'meta-delivery', 'meta-delivery',
    jsonb_build_object('deliveryId', delivery_id), 'meta-delivery:' || delivery_id
)
FROM public.meta_inbox
WHERE processed_at IS NULL
ORDER BY received_at, id;

SELECT public.job_enqueue(
    NULL::uuid, 'telegram-delivery', 'telegram-delivery',
    jsonb_build_object('deliveryId', delivery_id), 'telegram-delivery:' || delivery_id
)
FROM public.telegram_inbox
WHERE processed_at IS NULL
    AND jsonb_typeof(payload -> 'rawBody') = 'string'
    AND jsonb_typeof(payload -> 'connection') = 'string'
    AND length(payload ->> 'connection') > 0
ORDER BY received_at, id;

SELECT public.job_enqueue(
    NULL::uuid, 'zalo-delivery', 'zalo-delivery',
    jsonb_build_object('deliveryId', delivery_id), 'zalo-delivery:' || delivery_id
)
FROM public.zalo_inbox
WHERE processed_at IS NULL
    AND jsonb_typeof(payload -> 'rawBody') = 'string'
    AND jsonb_typeof(payload -> 'connection') = 'string'
    AND length(payload ->> 'connection') > 0
ORDER BY received_at, id;

SELECT public.job_enqueue(
    NULL::uuid, 'sepay-delivery', 'sepay-delivery',
    jsonb_build_object('deliveryId', sepay_id::text), 'sepay-delivery:' || sepay_id::text
)
FROM public.sepay_transactions
WHERE processed_at IS NULL
ORDER BY received_at, id;

SELECT public.job_enqueue(
    NULL::uuid, 'vietcombank-delivery', 'vietcombank-delivery',
    jsonb_build_object('deliveryId', delivery_id), 'vietcombank-delivery:' || delivery_id
)
FROM public.vietcombank_inbox
WHERE processed_at IS NULL
ORDER BY received_at, id;

SELECT public.job_enqueue(
    NULL::uuid, 'bank-feed-delivery', 'bank-feed-delivery',
    jsonb_build_object('provider', provider, 'deliveryId', delivery_id),
    'bank-feed-delivery:' || provider || ':' || delivery_id
)
FROM public.bank_feed_inbox
WHERE processed_at IS NULL
ORDER BY received_at, id;
