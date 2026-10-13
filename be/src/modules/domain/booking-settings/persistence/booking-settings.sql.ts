import { sql } from "@modules/platform/database"

/** Saves policy without changing the public page ($1 workspace, $2 cancellation hours, $3 deposit, $4 late fee, $5 no-show fee,
 * $6 lead minutes, $7 advance days, $8 slot step, $9 auto confirm, $10 handoff, $11 address, $12 time zone, $13 now). */
export const UPSERT_SETUP_POLICY = sql`INSERT INTO public.booking_settings
    (workspace_id, cancel_window_hours, deposit_pct, late_cancel_fee_pct, no_show_fee_vnd,
     min_lead_min, max_advance_days, slot_step_min, auto_confirm, handoff_order, address, timezone, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz)
ON CONFLICT (workspace_id) DO UPDATE SET
    cancel_window_hours = excluded.cancel_window_hours, deposit_pct = excluded.deposit_pct,
    late_cancel_fee_pct = excluded.late_cancel_fee_pct, no_show_fee_vnd = excluded.no_show_fee_vnd,
    min_lead_min = excluded.min_lead_min, max_advance_days = excluded.max_advance_days,
    slot_step_min = excluded.slot_step_min, auto_confirm = excluded.auto_confirm,
    handoff_order = excluded.handoff_order, address = excluded.address,
    timezone = excluded.timezone, updated_at = excluded.updated_at
RETURNING workspace_id AS id`

/** Finds another workspace using a public slug ($1 workspace, $2 slug). */
export const SELECT_SETUP_SLUG_OWNER = sql`SELECT workspace_id AS id FROM public.booking_settings
WHERE workspace_id <> $1 AND public_slug = $2 LIMIT 1`

/** Saves publishing settings without changing policy ($1 workspace, $2 enabled, $3 slug, $4 note, $5 now). */
export const UPSERT_SETUP_PUBLIC_PAGE = sql`INSERT INTO public.booking_settings
    (workspace_id, public_enabled, public_slug, public_note, updated_at)
VALUES ($1, $2, $3, $4, $5::timestamptz)
ON CONFLICT (workspace_id) DO UPDATE SET
    public_enabled = excluded.public_enabled, public_slug = excluded.public_slug,
    public_note = excluded.public_note, updated_at = excluded.updated_at
RETURNING workspace_id AS id`
