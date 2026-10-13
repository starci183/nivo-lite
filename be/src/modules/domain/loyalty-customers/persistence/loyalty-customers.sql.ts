import { sql } from "@modules/platform/database"

/** The customer with a phone ($1 workspace, $2 phone). */
export const SELECT_CUSTOMER_BY_PHONE = sql`SELECT id, name, phone, email, birthday::text AS birthday, tier_key, joined_at, note
FROM public.loyalty_customers
WHERE workspace_id = $1 AND phone = $2
LIMIT 1`

/** The customer with an id ($1 workspace, $2 customer). */
export const SELECT_CUSTOMER_BY_ID = sql`SELECT id, name, phone, email, birthday::text AS birthday, tier_key, joined_at, note
FROM public.loyalty_customers
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** Writes a customer unless the phone or the email already belongs to one, and answers the new id ($1 workspace, $2 name, $3 phone, $4 email). */
export const INSERT_CUSTOMER = sql`INSERT INTO public.loyalty_customers (workspace_id, name, phone, email)
VALUES ($1, $2, $3, $4)
ON CONFLICT DO NOTHING
RETURNING id`

/** Moves a customer to a tier if nobody moved it first, and answers the id when it moved ($1 workspace, $2 customer, $3 new tier, $4 tier expected now or null, $5 now). */
export const UPDATE_CUSTOMER_TIER = sql`WITH moved AS (
  UPDATE public.loyalty_customers
  SET tier_key = $3, tier_since = $5::timestamptz, updated_at = $5::timestamptz
  WHERE workspace_id = $1 AND id = $2 AND tier_key IS NOT DISTINCT FROM $4
  RETURNING id
)
SELECT id FROM moved`

/** Writes the customers of a batch of leads that are not customers yet, and answers the new ids ($1 workspace, $2 names, $3 phones, $4 emails). */
export const INSERT_CUSTOMERS_FROM_LEADS = sql`INSERT INTO public.loyalty_customers (workspace_id, name, phone, email)
SELECT $1, t.name, t.phone, t.email
FROM unnest($2::text[], $3::text[], $4::text[]) AS t(name, phone, email)
ON CONFLICT DO NOTHING
RETURNING id`

/** The leads of a workspace that have a contact, oldest first ($1 workspace). */
export const SELECT_LEAD_CONTACTS = sql`SELECT id, contact_name, phone, email
FROM public.leads
WHERE workspace_id = $1 AND (phone IS NOT NULL OR email IS NOT NULL)
ORDER BY created_at
LIMIT 2000`

/** Changes supplied profile fields ($1 workspace, $2 customer, $3 name or null, $4 birthday supplied, $5 birthday or null, $6 note or null). */
export const UPDATE_CUSTOMER_PROFILE = sql`WITH changed AS (
  UPDATE public.loyalty_customers
  SET name = COALESCE($3, name), birthday = CASE WHEN $4::boolean THEN $5::date ELSE birthday END,
      note = COALESCE($6, note), updated_at = now()
  WHERE workspace_id = $1 AND id = $2
  RETURNING id
)
SELECT id FROM changed`
