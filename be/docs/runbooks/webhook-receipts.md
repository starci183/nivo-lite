# Webhook receipts

Every provider webhook (Telegram, Zalo OA, Meta, SePay, Casso, PayOS) and every poll is received into
`public.account_data` (migration `20261112022700_account-data.sql`, one partition per declared type generated into
`20261112022900_account-data-types.sql`). The door resolves the connection and hands the provider's rows to the one
intake: each row is a declared type (`telegram.update`, `zalo_oa.event`, `meta.event`, `sepay.delivery`, ...), keyed by
the provider's own id (`key`), its value validated against the type's declaration. The unique key
`(type, connection_id, key)` IS the dedupe: an insert that writes a row is a new delivery, one that writes nothing is a
redelivery and queues nothing.

A row of a type that wakes (`wakes: true` in its declaration: the event and delivery types) is the consumer's work
row: `processed_at IS NULL` means pending. The queue messages keep `{ deliveryId }` = `<connection uuid>:<key>`; the
consumer locks the pending row of its event type and completes it in the same transaction as its business effects.

The API hosts every receipt consumer; the CLI runs producers only and disables workers. Keep the existing
`meta_inbound` consumer: Meta receipt processing publishes its downstream jobs there. Use the existing jobs retry
operation for a failed outbox job after fixing its cause; see [jobs operations](jobs-operations.md).

## Inspect pending receipts

Run this read-only inventory with the deployment database connection. It returns identities only, never values or
credentials:

```sql
SELECT type, provider, connection_id, key, occurred_at, created_at
FROM public.account_data
WHERE processed_at IS NULL
  AND type IN ('telegram.update', 'zalo_oa.event', 'meta.event', 'sepay.delivery', 'casso.delivery', 'payos.delivery')
ORDER BY created_at;
```

The pending count per account and type:

```sql
SELECT type, connection_id, count(*) AS pending, min(created_at) AS oldest
FROM public.account_data
WHERE processed_at IS NULL
  AND type IN ('telegram.update', 'zalo_oa.event', 'meta.event', 'sepay.delivery', 'casso.delivery', 'payos.delivery')
GROUP BY type, connection_id
ORDER BY oldest;
```

The list of waking types is the catalog's (`be/src/modules/domain/account-data-catalog`): a type whose declaration
does not wake never has a pending row (its `processed_at` stays null and means nothing).

A pending row whose queue job failed is retried through the jobs operations; its dedupe key is
`<queue>:<delivery_id>` (bank feeds: `<queue>:<provider>:<delivery_id>`), where `delivery_id` is
`<connection>:<key>`. Do not change a dedupe key to force a second successful effect. Consumers lock the pending row
and commit their business effects with its completion, so a successful replay performs no second effect. A row is
never edited by hand: its value is the provider's own body as it was received.

## Retention

The end-of-day tick `account-data-retention` (`45 16 * * *` UTC, queue `account_data_retention`, payload
`{ batch: 1000 }`) runs the fenced job `sweep-account-data`. Retention is per declared type: rows older than the type's
`retention.days` are deleted (a waking type: completed rows only, a pending row is never deleted), rows older than the
type's `ttlMs` are deleted, and a type declared `retention: "keep"` without a ttl is never touched. Deletes run in
bounded batches per type, oldest first, the job's fence asked before every batch; a type stops after its batch budget
and the next pass continues. `cli jobs tick account-data-retention` sends the same tick by hand.
