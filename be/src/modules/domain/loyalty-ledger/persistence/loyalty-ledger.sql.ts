import { sql } from "@modules/platform/database"

/** Locks one customer of a workspace for the rest of the transaction ($1 customer, $2 workspace). */
export const LOCK_CUSTOMER = sql`SELECT id
FROM public.loyalty_customers
WHERE id = $1 AND workspace_id = $2
LIMIT 1
FOR UPDATE`

/** The entry a key already wrote ($1 workspace, $2 key). */
export const SELECT_ENTRY_BY_REF = sql`SELECT id
FROM public.loyalty_ledger
WHERE workspace_id = $1 AND ref = $2
LIMIT 1`

/** The points a customer holds ($1 customer). */
export const SELECT_BALANCE = sql`SELECT COALESCE(sum(points), 0)::int AS points
FROM public.loyalty_ledger
WHERE customer_id = $1`

/** Writes one ledger entry and answers its id ($1 workspace, $2 customer, $3 kind, $4 points, $5 key, $6 by, $7 amount, $8 order, $9 invoice,
 * $10 reward, $11 evidence, $12 expires, $13 occurred). */
export const INSERT_ENTRY = sql`INSERT INTO public.loyalty_ledger (workspace_id, customer_id, kind, points, ref, by_name, amount_vnd, order_id, invoice_id,
  reward_id, evidence, expires_at, occurred_at)
VALUES ($1, $2, $3, $4, $5, COALESCE(NULLIF($6, ''), 'NIVO'), $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz)
RETURNING id`

/** Every customer of a workspace with the balance the ledger gives, newest first ($1 workspace). */
export const SELECT_MEMBERS = sql`SELECT c.id, c.name, c.phone, c.email, c.birthday::text AS birthday, c.tier_key, c.joined_at, c.note,
       COALESCE(sum(l.points), 0)::int AS points,
       COALESCE(sum(l.amount_vnd) FILTER (WHERE l.kind = 'earn'), 0)::float8 AS lifetime_spend_vnd,
       (count(l.id) FILTER (WHERE l.kind = 'earn' AND l.order_id IS NOT NULL))::int AS visits,
       max(l.occurred_at) FILTER (WHERE l.kind = 'earn') AS last_visit_at
FROM public.loyalty_customers c
LEFT JOIN public.loyalty_ledger l ON l.customer_id = c.id
WHERE c.workspace_id = $1
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 2000`

/** One customer of a workspace with the balance the ledger gives ($1 workspace, $2 customer). */
export const SELECT_MEMBER = sql`SELECT c.id, c.name, c.phone, c.email, c.birthday::text AS birthday, c.tier_key, c.joined_at, c.note,
       COALESCE(sum(l.points), 0)::int AS points,
       COALESCE(sum(l.amount_vnd) FILTER (WHERE l.kind = 'earn'), 0)::float8 AS lifetime_spend_vnd,
       (count(l.id) FILTER (WHERE l.kind = 'earn' AND l.order_id IS NOT NULL))::int AS visits,
       max(l.occurred_at) FILTER (WHERE l.kind = 'earn') AS last_visit_at
FROM public.loyalty_customers c
LEFT JOIN public.loyalty_ledger l ON l.customer_id = c.id
WHERE c.workspace_id = $1 AND c.id = $2
GROUP BY c.id
LIMIT 1`

/** The newest entries of a customer ($1 workspace, $2 customer, $3 how many). */
export const SELECT_TIMELINE = sql`SELECT id, customer_id, kind, points, amount_vnd::float8 AS amount_vnd, order_id, ref, by_name, evidence, reward_id, work_item_id,
       expires_at, occurred_at
FROM public.loyalty_ledger
WHERE workspace_id = $1 AND customer_id = $2
ORDER BY occurred_at DESC
LIMIT $3`

/** How many times a customer redeemed each reward ($1 customer). */
export const COUNT_REDEEMED = sql`SELECT reward_id, count(*)::int AS total
FROM public.loyalty_ledger
WHERE customer_id = $1 AND kind = 'redeem' AND reward_id IS NOT NULL
GROUP BY reward_id
LIMIT 200`

/** The entries that decide what is still unspent, for one customer ($1 customer). */
export const SELECT_EXPIRY_ENTRIES = sql`SELECT kind, points, expires_at
FROM public.loyalty_ledger
WHERE customer_id = $1
ORDER BY occurred_at
LIMIT 2000`

/** What each kind of entry came to since an instant ($1 workspace, $2 since). */
export const SELECT_TOTALS_SINCE = sql`SELECT kind, count(*)::int AS entries, COALESCE(sum(points), 0)::int AS points, COALESCE(sum(amount_vnd), 0)::float8 AS amount_vnd
FROM public.loyalty_ledger
WHERE workspace_id = $1 AND occurred_at >= $2::timestamptz
GROUP BY kind
LIMIT 4`
