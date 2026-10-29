import { sql } from "@modules/platform/database"

/** The flow of one lead of the workspace. */
export const FIND_FLOW_BY_LEAD = sql`
    SELECT * FROM public.lead_flows WHERE workspace_id = $1 AND lead_id = $2 LIMIT 1`

/** The installation a flow of the workspace belongs to; no row when the flow is missing or names none. */
export const FIND_FLOW_INSTALLATION = sql`
    SELECT installation_id FROM public.lead_flows WHERE workspace_id = $1 AND id = $2 AND installation_id IS NOT NULL LIMIT 1`

/** The flows any identity key matches (Messenger id, Instagram id, phone, email), oldest first. */
export const FIND_FLOW_CANDIDATES = sql`
    SELECT * FROM public.lead_flows
    WHERE workspace_id = $1
      AND (($2::text IS NOT NULL AND psid = $2)
        OR ($3::text IS NOT NULL AND igsid = $3)
        OR ($4::text IS NOT NULL AND phone = $4)
        OR ($5::text IS NOT NULL AND email = $5))
    ORDER BY created_at
    LIMIT 20`

/** Opens a flow; a unique key already taken (the same person at once) inserts nothing. */
export const INSERT_FLOW = sql`
    INSERT INTO public.lead_flows
        (workspace_id, lead_id, connection_id, platform, psid, igsid, phone, email, name, source, touches, last_user_at, last_user_text)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::timestamptz, $13)
    ON CONFLICT DO NOTHING
    RETURNING *`

/** Writes every mutable column of a flow of the workspace and answers the stored row. */
export const SAVE_FLOW = sql`
    WITH saved AS (
    UPDATE public.lead_flows SET
        lead_id = $3, connection_id = $4, conversation_id = $5, platform = $6, psid = $7, igsid = $8, phone = $9, email = $10,
        name = $11, state = $12, resume_state = $13, source = $14::jsonb, touches = $15::jsonb, answers = $16::jsonb, asked = $17,
        pending_question = $18, contact_asked_at = $19::timestamptz, signals = $20::jsonb, score = $21, score_reasons = $22::jsonb,
        scored_at = $23::timestamptz, analysis = $24::jsonb, last_user_at = $25::timestamptz, last_user_text = $26,
        greeted_at = $27::timestamptz, handed_off_at = $28::timestamptz, followed_up_at = $29::timestamptz,
        closed_at = $30::timestamptz, escalated_at = $31::timestamptz, escalation_reason = $32, updated_at = now()
    WHERE id = $1 AND workspace_id = $2
    RETURNING *
    )
    SELECT * FROM saved`
