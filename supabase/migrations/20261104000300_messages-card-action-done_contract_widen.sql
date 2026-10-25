-- Customer turns emit the v1 action_done card already supported by the Hub card contract.
-- Preserve every existing card type, shape, version and byte-size requirement.
ALTER TABLE public.messages DROP CONSTRAINT messages_card_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_card_check
    CHECK (card IS NULL OR (
        jsonb_typeof(card) = 'object'
        AND card->>'v' = '1'
        AND card->>'type' = ANY (ARRAY['draft_post', 'video_ready', 'approval_request', 'schedule_confirmed',
                                        'weekly_report', 'booking_held', 'daily_summary', 'handoff_note', 'exception',
                                        'action_done'])
        AND octet_length(card::text) <= 65536));
