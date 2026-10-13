import { sql } from "@modules/platform/database"

/** One fact of a workspace ($1 workspace, $2 id). */
export const SELECT_FACT = sql`SELECT * FROM public.brain_facts WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** The facts of one subject + attribute in one status and one scope ($1 workspace, $2 subject key, $3 attribute, $4 status, $5 installation or null). */
export const SELECT_FACTS_BY_KEY = sql`SELECT * FROM public.brain_facts
WHERE workspace_id = $1 AND subject_key = $2 AND attribute = $3 AND status = $4 AND installation_id IS NOT DISTINCT FROM $5::uuid
ORDER BY proposed_at DESC LIMIT 50`

/** Facts of a workspace, newest first ($1 workspace, $2 statuses or null for all, $3 subject key or null, $4 limit). */
export const SELECT_FACTS = sql`SELECT * FROM public.brain_facts
WHERE workspace_id = $1 AND ($2::text[] IS NULL OR status = ANY($2::text[])) AND ($3::text IS NULL OR subject_key = $3)
ORDER BY updated_at DESC LIMIT $4`

/** Proposed, scheduled and active facts that rest on a document ($1 workspace, $2 evidence pattern as json). */
export const SELECT_FACTS_OF_DOCUMENT = sql`SELECT * FROM public.brain_facts
WHERE workspace_id = $1 AND status IN ('proposed', 'scheduled', 'active') AND evidence @> $2::jsonb LIMIT 2000`

/** Stores a new proposal ($1 workspace, $2 type, $3 subject key, $4 subject label, $5 attribute, $6 attribute label, $7 value, $8 number, $9 unit, $10 scope, $11 modules, $12 source kind, $13 trust, $14 valid from, $15 valid to, $16 conflict with, $17 evidence, $18 proposed by, $19 installation, $20 proposal kind). */
export const INSERT_FACT = sql`WITH changed AS (
    INSERT INTO public.brain_facts
        (workspace_id, subject_type, subject_key, subject_label, attribute, attribute_label, value, value_number, unit, scope, modules,
         status, source_kind, trust, valid_from, valid_to, conflict_with, evidence, proposed_by, installation_id, proposal_kind)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], 'proposed', $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20)
    RETURNING *
)
SELECT * FROM changed`

/** Adds evidence and trust to a fact ($1 workspace, $2 id, $3 evidence, $4 trust). */
export const UPDATE_EVIDENCE = sql`WITH changed AS (
    UPDATE public.brain_facts SET evidence = $3::jsonb, trust = $4, updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *
)
SELECT * FROM changed`

/** Replaces the evidence of a fact ($1 workspace, $2 id, $3 evidence). */
export const UPDATE_EVIDENCE_ONLY = sql`WITH changed AS (
    UPDATE public.brain_facts SET evidence = $3::jsonb, updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING id
)
SELECT id FROM changed`

/** Rejects the waiting proposals to stop using a value of one key ($1 workspace, $2 subject key, $3 attribute, $4 installation or null, $5 note). */
export const REJECT_RETIRE_PROPOSALS = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'rejected', decision_note = $5, decided_at = now(), updated_at = now()
    WHERE workspace_id = $1 AND subject_key = $2 AND attribute = $3 AND status = 'proposed' AND proposal_kind = 'retire'
        AND installation_id IS NOT DISTINCT FROM $4::uuid
    RETURNING id
)
SELECT id FROM changed`

/** Turns a waiting proposal down ($1 workspace, $2 id, $3 decided by, $4 note). */
export const REJECT_FACT = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'rejected', decided_by = $3, decided_at = now(), decision_note = $4, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'proposed' RETURNING *
)
SELECT * FROM changed`

/** Stops an active fact: it expires now ($1 workspace, $2 id, $3 decided by, $4 note). */
export const RETIRE_FACT = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'expired', valid_to = now(), decided_by = $3, decided_at = now(), decision_note = $4, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'active' RETURNING *
)
SELECT * FROM changed`

/** Closes an applied proposal to stop using a fact ($1 workspace, $2 id, $3 decided by, $4 note). */
export const CLOSE_RETIRE_PROPOSAL = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'expired', decided_by = $3, decided_at = now(), decision_note = $4, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'proposed' RETURNING *
)
SELECT * FROM changed`

/** Replaces an older scheduled change of one key ($1 workspace, $2 subject key, $3 attribute, $4 installation or null). */
export const REJECT_SCHEDULED = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'rejected', decision_note = 'Replaced by a newer schedule', updated_at = now()
    WHERE workspace_id = $1 AND subject_key = $2 AND attribute = $3 AND status = 'scheduled' AND installation_id IS NOT DISTINCT FROM $4::uuid
    RETURNING id
)
SELECT id FROM changed`

/** Ends the value in force at a later instant ($1 workspace, $2 id, $3 valid to). */
export const END_ACTIVE_AT = sql`WITH changed AS (
    UPDATE public.brain_facts SET valid_to = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2 AND status = 'active' RETURNING id
)
SELECT id FROM changed`

/** Schedules an approved proposal ($1 workspace, $2 id, $3 replaced fact, $4 decided by, $5 note). */
export const SCHEDULE_FACT = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'scheduled', supersedes_id = $3, conflict_with = NULL, decided_by = $4, decided_at = now(), decision_note = $5, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'proposed' RETURNING *
)
SELECT * FROM changed`

/** Closes the value in force, kept as history ($1 workspace, $2 id). */
export const SUPERSEDE_FACT = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'superseded', valid_to = coalesce(valid_to, now()), updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'active' RETURNING id
)
SELECT id FROM changed`

/** Makes an approved proposal the value in force ($1 workspace, $2 id, $3 replaced fact, $4 decided by, $5 note). */
export const ACTIVATE_FACT = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'active', supersedes_id = $3, conflict_with = NULL, decided_by = $4, decided_at = now(),
        decision_note = $5, valid_from = coalesce(valid_from, now()), updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'proposed' RETURNING *
)
SELECT * FROM changed`

/** Scheduled facts whose time has come ($1 workspace). */
export const SELECT_DUE_FACTS = sql`SELECT * FROM public.brain_facts WHERE workspace_id = $1 AND status = 'scheduled' AND valid_from <= now() LIMIT 200`

/** Makes a scheduled fact the value in force ($1 workspace, $2 id). */
export const PROMOTE_FACT = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'active', updated_at = now() WHERE workspace_id = $1 AND id = $2 AND status = 'scheduled' RETURNING *
)
SELECT * FROM changed`

/** Expires the active facts whose validity ended ($1 workspace). */
export const EXPIRE_DUE_FACTS = sql`WITH changed AS (
    UPDATE public.brain_facts SET status = 'expired', updated_at = now() WHERE workspace_id = $1 AND status = 'active' AND valid_to < now() RETURNING id
)
SELECT id FROM changed`
