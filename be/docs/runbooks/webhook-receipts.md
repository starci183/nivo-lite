# Deferred webhook receipt rollout

Apply `db/migrations/20261026000500_webhook-receipt-queues.sql` and
`db/migrations/20261026000600_webhook-receipt-backfill.sql` before starting the new API workers.
The API hosts all six receipt consumers; the CLI runs producers only and disables workers.
Keep the existing `meta_inbound` consumer: Meta receipt processing publishes its downstream jobs there.

The backfill uses the same `public.job_enqueue` transaction and dedupe identities as live intake.
It queues pending receipts only and preserves completed receipts and existing outbox rows.
A repeated backfill does not resend an existing job. Use the existing jobs retry operation for a
failed outbox job after fixing its cause; see [jobs operations](jobs-operations.md).

## Inspect pending legacy receipts before deployment

Run this read-only inventory using the deployment database connection. It returns identities and
payload readiness, without exposing payloads or credentials:

```sql
SELECT 'telegram' AS provider, id, delivery_id, received_at,
    jsonb_typeof(payload -> 'rawBody') = 'string'
        AND jsonb_typeof(payload -> 'connection') = 'string'
        AND length(payload ->> 'connection') > 0 AS ready
FROM public.telegram_inbox WHERE processed_at IS NULL
UNION ALL
SELECT 'zalo', id, delivery_id, received_at,
    jsonb_typeof(payload -> 'rawBody') = 'string'
        AND jsonb_typeof(payload -> 'connection') = 'string'
        AND length(payload ->> 'connection') > 0
FROM public.zalo_inbox WHERE processed_at IS NULL;
```

Treat `ready IS NOT TRUE` as requiring recovery. Older atomic intakes stored only message/update IDs;
the message body cannot be reconstructed from those receipt rows. Do not queue these rows, mark them
processed, delete them, or replace their delivery identity. The backfill deliberately skips them.
Recover the original verified delivery bytes and connection from the provider's retained delivery
record, then have an operator review a narrowly scoped, parameterized update of that pending row's
payload to `{ "connection": "<original connection>", "rawBody": "<original JSON text>" }`.
Recheck that the decoded connection-prefixed update/message ID equals the existing `delivery_id`.
If the provider no longer retains the delivery, record the unresolved receipt identity for manual
recovery; its IDs alone are insufficient to replay the original message safely.

After recovery, rerun the matching SELECT from the backfill migration in a transaction. Its dedupe
key is `<queue>:<delivery_id>`; bank-feed keys also include `<provider>:` before the delivery ID.
Do not change a dedupe key to force a second successful effect. Monitor pending counts, job failures
and completion timestamps until the recoverable backlog drains. Consumers lock pending receipt rows
and commit their business effects with completion, so successful replays perform no second effect.

Meta and SePay legacy receipts retain their original payload and are queued by the migration.
Bank-feed receipts are newly introduced by this rollout. This edit-only change does
not execute any migrations or recover production data; the deployment operator owns this inventory.
