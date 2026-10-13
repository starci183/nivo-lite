import { sql } from "@modules/platform/database"

/** The latest correction notes of one workspace. */
export const LIST_ADJUSTMENTS = sql`SELECT id, target_type, target_id, note, corrected_amount_vnd::float8 AS corrected_amount_vnd, created_by, created_at::text AS created_at FROM public.accounting_adjustments WHERE workspace_id = $1::uuid ORDER BY created_at DESC, id DESC LIMIT 500`

/** Appends a correction; original money records remain immutable. */
export const INSERT_ADJUSTMENT = sql`INSERT INTO public.accounting_adjustments (workspace_id, target_type, target_id, note, corrected_amount_vnd, created_by) VALUES ($1::uuid, $2, $3::uuid, $4, $5::bigint, $6) RETURNING id, target_type, target_id, note, corrected_amount_vnd::float8 AS corrected_amount_vnd, created_by, created_at::text AS created_at`
