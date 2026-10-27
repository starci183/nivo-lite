import { sql } from "@modules/platform/database"

/** Lists the contracts of one workspace for its sales workbench ($1 workspace). */
export const LIST_CONTRACTS = sql`SELECT id, lead_id, customer_name, plan,
    to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on,
    amount_vnd::float8 AS amount_vnd, status, note
FROM public.contracts WHERE workspace_id = $1::uuid ORDER BY ends_on ASC, id ASC LIMIT 300`

/** Writes one contract, linked to a lead of the workspace when it names one, and answers it, or answers nothing when the lead is not the workspace own ($1 workspace, $2 lead, $3 customer, $4 plan, $5 start, $6 end, $7 amount, $8 status, $9 note). */
export const INSERT_CONTRACT = sql`WITH changed AS (
    INSERT INTO public.contracts (workspace_id, lead_id, customer_name, plan, starts_on, ends_on, amount_vnd, status, note)
    SELECT $1::uuid, $2::uuid, $3::text, $4::text, $5::date, $6::date, $7::bigint, $8::text, $9::text
    WHERE $2::uuid IS NULL OR EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = $1::uuid AND id = $2::uuid)
    RETURNING id, lead_id, customer_name, plan, starts_on, ends_on, amount_vnd, status, note
)
SELECT id, lead_id, customer_name, plan, to_char(starts_on, 'YYYY-MM-DD') AS starts_on,
    to_char(ends_on, 'YYYY-MM-DD') AS ends_on, amount_vnd::float8 AS amount_vnd, status, note
FROM changed`

/** Changes one contract of the workspace, linked to a lead of the workspace when it names one, and answers it ($1 workspace, $2 id, $3 lead, $4 customer, $5 plan, $6 start, $7 end, $8 amount, $9 status, $10 note). */
export const UPDATE_CONTRACT = sql`WITH changed AS (
    UPDATE public.contracts
    SET lead_id = $3, customer_name = $4, plan = $5, starts_on = $6, ends_on = $7, amount_vnd = $8, status = $9, note = $10,
        updated_at = now()
    WHERE workspace_id = $1 AND id = $2
      AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = $1 AND id = $3::uuid))
    RETURNING id, lead_id, customer_name, plan, starts_on, ends_on, amount_vnd, status, note
)
SELECT id, lead_id, customer_name, plan, to_char(starts_on, 'YYYY-MM-DD') AS starts_on,
    to_char(ends_on, 'YYYY-MM-DD') AS ends_on, amount_vnd::float8 AS amount_vnd, status, note
FROM changed`

/** Links a lead of the workspace to a contract of the workspace that had none ($1 workspace, $2 contract, $3 lead). */
export const ATTACH_CONTRACT_LEAD = sql`UPDATE public.contracts SET lead_id = $3::uuid, updated_at = now()
WHERE workspace_id = $1::uuid AND id = $2::uuid AND lead_id IS NULL
  AND EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = $1::uuid AND id = $3::uuid)`

/** Locks one contract of the workspace for a renewal and answers it ($1 workspace, $2 contract). */
export const LOCK_CONTRACT = sql`SELECT id, lead_id, customer_name, plan,
    to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on,
    amount_vnd::float8 AS amount_vnd, status, note
FROM public.contracts WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1 FOR UPDATE`

/** Moves one contract of the workspace to its next term and makes it active, only while it still ends on the renewed day ($1 workspace, $2 contract, $3 renewed end, $4 new start, $5 new end, $6 note). */
export const EXTEND_CONTRACT_TERM = sql`WITH changed AS (
    UPDATE public.contracts
    SET starts_on = $4::date, ends_on = $5::date, status = 'active', note = $6::text, updated_at = now()
    WHERE workspace_id = $1::uuid AND id = $2::uuid AND ends_on = $3::date AND status <> 'cancelled'
    RETURNING id, lead_id, customer_name, plan, starts_on, ends_on, amount_vnd, status, note
)
SELECT id, lead_id, customer_name, plan, to_char(starts_on, 'YYYY-MM-DD') AS starts_on,
    to_char(ends_on, 'YYYY-MM-DD') AS ends_on, amount_vnd::float8 AS amount_vnd, status, note
FROM changed`

/** Serialises the customer links of one workspace, so two runs never capture the same customer twice ($1 workspace). */
export const LOCK_CONTRACT_LINKING = sql`SELECT pg_advisory_xact_lock(hashtext('contracts.link:' || $1::text))`

/** The contracts of a workspace with the contact of their lead, for the customer link ($1 workspace). */
export const LIST_CONTRACTS_TO_LINK = sql`SELECT c.id, c.lead_id, c.customer_name, c.plan, c.note,
    l.phone AS lead_phone, l.email AS lead_email
FROM public.contracts c
LEFT JOIN public.leads l ON l.workspace_id = c.workspace_id AND l.id = c.lead_id
WHERE c.workspace_id = $1::uuid
ORDER BY c.created_at ASC, c.id ASC
LIMIT 2000`

/** The customer records the data hub synced for a workspace, newest first, with their source name ($1 workspace). */
export const LIST_CUSTOMER_RECORDS = sql`SELECT r.external_id, r.title, r.data, s.name AS source
FROM public.data_records r
LEFT JOIN public.connections s ON s.workspace_id = r.workspace_id AND s.id = r.connection_id
WHERE r.workspace_id = $1::uuid AND r.entity = 'customer'
ORDER BY r.synced_at DESC, r.id ASC
LIMIT 5000`

/** Moves one contract of the workspace to a lead of the workspace, only while it still links to the lead it was read with ($1 workspace, $2 contract, $3 lead read or null, $4 new lead). */
export const RELINK_CONTRACT_LEAD = sql`WITH changed AS (
    UPDATE public.contracts SET lead_id = $4::uuid, updated_at = now()
    WHERE workspace_id = $1::uuid AND id = $2::uuid AND lead_id IS NOT DISTINCT FROM $3::uuid
      AND EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = $1::uuid AND id = $4::uuid)
    RETURNING id
)
SELECT id FROM changed`
