import { sql } from "@modules/platform/database"

/** One lead of the workspace ($1 workspace, $2 lead). */
export const FIND_LEAD = sql`SELECT id, workspace_id, contact_name, company, channel, need, stage, context_summary, phone, email, origin
FROM public.leads WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The customer an input belongs to; a phone beats an email beats a name ($1 workspace, $2 phone, $3 email, $4 name, $5 channel). */
export const MATCH_LEAD = sql`SELECT id, workspace_id, contact_name, company, channel, need, stage, context_summary, phone, email, origin
FROM public.leads
WHERE workspace_id = $1::uuid
  AND (
    ($2::text IS NOT NULL AND phone = $2::text)
    OR ($3::text IS NOT NULL AND email = $3::text)
    OR ($2::text IS NULL AND $3::text IS NULL AND $4::text IS NOT NULL AND $5::text IS NOT NULL AND contact_name = $4::text AND channel = $5::text)
  )
ORDER BY CASE WHEN phone = $2::text THEN 0 WHEN email = $3::text THEN 1 ELSE 2 END, created_at
LIMIT 1`

/** Captures a customer ($1 workspace, $2 name, $3 company, $4 channel, $5 need, $6 phone, $7 email, $8 origin). */
export const INSERT_LEAD = sql`INSERT INTO public.leads (workspace_id, contact_name, company, channel, need, phone, email, origin)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, workspace_id, contact_name, company, channel, need, stage, context_summary, phone, email, origin`

/** Adds the contact a lead was missing ($1 workspace, $2 lead, $3 phone or null, $4 email or null). */
export const FILL_LEAD_CONTACT = sql`UPDATE public.leads
SET phone = COALESCE(phone, $3::text), email = COALESCE(email, $4::text)
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** Moves an open deal forward and keeps the first context brief ($1 workspace, $2 lead, $3 stage or null, $4 brief or null). */
export const APPLY_CLASSIFICATION = sql`UPDATE public.leads
SET stage = CASE WHEN stage IN ('won', 'lost') OR $3::text = 'won' THEN stage ELSE COALESCE($3::text, stage) END,
    context_summary = COALESCE(context_summary, $4::text)
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** A won deal, unless it was lost ($1 workspace, $2 lead). */
export const MARK_LEAD_WON = sql`UPDATE public.leads SET stage = 'won'
WHERE workspace_id = $1::uuid AND id = $2::uuid AND stage <> 'lost'`

/** The names of several leads ($1 workspace, $2 lead ids). */
export const FIND_LEAD_NAMES = sql`SELECT id, contact_name
FROM public.leads WHERE workspace_id = $1::uuid AND id = ANY($2::uuid[])
LIMIT 200`
