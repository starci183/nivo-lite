-- chat-conversation-lead-field: forward-only; immutable once on origin/main.
-- A conversation was tied to its customer by the `lead` link (record_links) only; its `leadId` field stayed empty. The graph nodes find a
-- customer's conversation by that field (the payment confirmation, the Sales after-sale thanks), so after a payment the customer was told
-- nothing. The code now writes both; this fills the field from the link for the conversations tied before. Data only, idempotent.

UPDATE public.records AS c
SET data = jsonb_set(c.data, '{leadId}', to_jsonb(l.to_id::text)),
    version = c.version + 1,
    updated_at = now()
FROM public.record_links AS l
WHERE c.entity = 'chat.conversation'
  AND l.from_entity = 'chat.conversation'
  AND l.from_id = c.id
  AND l.workspace_id = c.workspace_id
  AND l.relation = 'lead'
  AND l.to_entity = 'sales.lead'
  AND (c.data->>'leadId') IS NULL;
