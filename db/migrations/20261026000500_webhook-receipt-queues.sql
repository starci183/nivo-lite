-- Deferred webhook receipt queues. pgmq and job_enqueue share the receipt transaction.
-- Workers use the existing backend-only public.job_* functions; schema/function access stays closed.

SELECT pgmq.create('meta-delivery');
REVOKE ALL ON TABLE pgmq."q_meta-delivery", pgmq."a_meta-delivery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."q_meta-delivery" TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."a_meta-delivery" TO app_be;
REVOKE ALL ON SEQUENCE pgmq."q_meta-delivery_msg_id_seq" FROM PUBLIC, anon, authenticated, app_be;

SELECT pgmq.create('telegram-delivery');
REVOKE ALL ON TABLE pgmq."q_telegram-delivery", pgmq."a_telegram-delivery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."q_telegram-delivery" TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."a_telegram-delivery" TO app_be;
REVOKE ALL ON SEQUENCE pgmq."q_telegram-delivery_msg_id_seq" FROM PUBLIC, anon, authenticated, app_be;

SELECT pgmq.create('zalo-delivery');
REVOKE ALL ON TABLE pgmq."q_zalo-delivery", pgmq."a_zalo-delivery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."q_zalo-delivery" TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."a_zalo-delivery" TO app_be;
REVOKE ALL ON SEQUENCE pgmq."q_zalo-delivery_msg_id_seq" FROM PUBLIC, anon, authenticated, app_be;

SELECT pgmq.create('sepay-delivery');
REVOKE ALL ON TABLE pgmq."q_sepay-delivery", pgmq."a_sepay-delivery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."q_sepay-delivery" TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."a_sepay-delivery" TO app_be;
REVOKE ALL ON SEQUENCE pgmq."q_sepay-delivery_msg_id_seq" FROM PUBLIC, anon, authenticated, app_be;

SELECT pgmq.create('vietcombank-delivery');
REVOKE ALL ON TABLE pgmq."q_vietcombank-delivery", pgmq."a_vietcombank-delivery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."q_vietcombank-delivery" TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."a_vietcombank-delivery" TO app_be;
REVOKE ALL ON SEQUENCE pgmq."q_vietcombank-delivery_msg_id_seq" FROM PUBLIC, anon, authenticated, app_be;

SELECT pgmq.create('bank-feed-delivery');
REVOKE ALL ON TABLE pgmq."q_bank-feed-delivery", pgmq."a_bank-feed-delivery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."q_bank-feed-delivery" TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgmq."a_bank-feed-delivery" TO app_be;
REVOKE ALL ON SEQUENCE pgmq."q_bank-feed-delivery_msg_id_seq" FROM PUBLIC, anon, authenticated, app_be;

-- The provider receipts have the telegram_inbox shape, unique key and backend-only RLS.

CREATE TABLE IF NOT EXISTS public.vietcombank_inbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    provider text NOT NULL,
    delivery_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT vietcombank_inbox_provider_check CHECK (provider = 'vietcombank'),
    CONSTRAINT vietcombank_inbox_provider_delivery_id_key UNIQUE (provider, delivery_id)
);
ALTER TABLE public.vietcombank_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vietcombank_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.vietcombank_inbox TO app_be;
DO $policies$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'vietcombank_inbox' AND policyname = 'vietcombank_inbox_app_be_insert'
    ) THEN
        CREATE POLICY vietcombank_inbox_app_be_insert ON public.vietcombank_inbox
            FOR INSERT TO app_be WITH CHECK (provider = 'vietcombank');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'vietcombank_inbox' AND policyname = 'vietcombank_inbox_app_be_select'
    ) THEN
        CREATE POLICY vietcombank_inbox_app_be_select ON public.vietcombank_inbox
            FOR SELECT TO app_be USING (provider = 'vietcombank');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'vietcombank_inbox' AND policyname = 'vietcombank_inbox_app_be_update'
    ) THEN
        CREATE POLICY vietcombank_inbox_app_be_update ON public.vietcombank_inbox
            FOR UPDATE TO app_be USING (provider = 'vietcombank') WITH CHECK (provider = 'vietcombank');
    END IF;
END;
$policies$;

CREATE TABLE IF NOT EXISTS public.bank_feed_inbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    provider text NOT NULL,
    delivery_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT bank_feed_inbox_provider_check CHECK (provider IN ('casso', 'payos', 'sepay-feed')),
    CONSTRAINT bank_feed_inbox_provider_delivery_id_key UNIQUE (provider, delivery_id)
);
ALTER TABLE public.bank_feed_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bank_feed_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bank_feed_inbox TO app_be;
DO $policies$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'bank_feed_inbox' AND policyname = 'bank_feed_inbox_app_be_insert'
    ) THEN
        CREATE POLICY bank_feed_inbox_app_be_insert ON public.bank_feed_inbox
            FOR INSERT TO app_be WITH CHECK (provider IN ('casso', 'payos', 'sepay-feed'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'bank_feed_inbox' AND policyname = 'bank_feed_inbox_app_be_select'
    ) THEN
        CREATE POLICY bank_feed_inbox_app_be_select ON public.bank_feed_inbox
            FOR SELECT TO app_be USING (provider IN ('casso', 'payos', 'sepay-feed'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'bank_feed_inbox' AND policyname = 'bank_feed_inbox_app_be_update'
    ) THEN
        CREATE POLICY bank_feed_inbox_app_be_update ON public.bank_feed_inbox
            FOR UPDATE TO app_be USING (provider IN ('casso', 'payos', 'sepay-feed')) WITH CHECK (provider IN ('casso', 'payos', 'sepay-feed'));
    END IF;
END;
$policies$;

-- Standalone claims used by the shared Inbox port have only their durable composite identity.
CREATE TABLE IF NOT EXISTS public.inbox (
    source text NOT NULL,
    delivery_id text NOT NULL,
    PRIMARY KEY (source, delivery_id)
);
ALTER TABLE public.inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inbox FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON TABLE public.inbox TO app_be;
DO $policies$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'inbox' AND policyname = 'inbox_app_be_insert'
    ) THEN
        CREATE POLICY inbox_app_be_insert ON public.inbox
            FOR INSERT TO app_be WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public'
            AND tablename = 'inbox' AND policyname = 'inbox_app_be_select'
    ) THEN
        CREATE POLICY inbox_app_be_select ON public.inbox
            FOR SELECT TO app_be USING (true);
    END IF;
END;
$policies$;
