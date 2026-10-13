import { sql } from "@modules/platform/database"

/** The agent a sender id names, with the instance name it carries when it is an installed agent ($1 workspace, $2 agent). */
export const FIND_SENDER_AGENT = sql`
    SELECT a.name, a.module, i.name AS installation_name
    FROM public.agents a
    LEFT JOIN public.module_installations i ON i.agent_id = a.id AND i.workspace_id = a.workspace_id
    WHERE a.workspace_id = $1::uuid AND a.id = $2::uuid
    LIMIT 1`

/** Where a parent item sits in its chain ($1 workspace, $2 parent). */
export const FIND_PARENT_POSITION = sql`
    SELECT id, chain_id, depth FROM public.work_items
    WHERE workspace_id = $1::uuid AND id = $2::uuid
    LIMIT 1`

/** The deepest item of a chain ($1 workspace, $2 chain). */
export const FIND_CHAIN_TOP = sql`
    SELECT depth FROM public.work_items
    WHERE workspace_id = $1::uuid AND chain_id = $2::uuid
    ORDER BY depth DESC
    LIMIT 1`

/**
 * Whether the chain already ran this action on this subject under another dedupe key: the cycle rule
 * ($1 workspace, $2 chain, $3 action, $4 subject type, $5 dedupe key, $6 subject or null).
 */
export const CHAIN_REPEATS_COMMAND = sql`
    SELECT EXISTS (
        SELECT 1 FROM public.work_items
        WHERE workspace_id = $1::uuid AND chain_id = $2::uuid AND action = $3 AND subject_type = $4
            AND dedupe_key <> $5 AND subject_id IS NOT DISTINCT FROM $6::uuid
    ) AS repeats`

/** A readable label of the subject for the Office line: the order number, the customer's name or the invoice number ($1 workspace, $2 type, $3 subject). */
export const FIND_SUBJECT_LABEL = sql`
    SELECT label FROM (
        SELECT order_no AS label FROM public.orders WHERE workspace_id = $1::uuid AND id = $3::uuid AND $2 = 'order'
        UNION ALL
        SELECT contact_name AS label FROM public.leads WHERE workspace_id = $1::uuid AND id = $3::uuid AND $2 = 'lead'
        UNION ALL
        SELECT invoice_no AS label FROM public.invoices WHERE workspace_id = $1::uuid AND id = $3::uuid AND $2 = 'invoice'
    ) labels
    LIMIT 1`

/** The installation a sender named, when it belongs to the module ($1 workspace, $2 module, $3 installation). */
export const FIND_GIVEN_INSTALLATION = sql`
    SELECT id, name FROM public.module_installations
    WHERE workspace_id = $1::uuid AND module_key = $2 AND id = $3::uuid
    LIMIT 1`

/** The installation the database resolves from the chain ($1 workspace, $2 module, $3 conversation, $4 lead, $5 chain). */
export const RESOLVE_INSTALLATION = sql`
    SELECT r.installation_id, r.via, i.name
    FROM public.resolve_installation($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid) r
    LEFT JOIN public.module_installations i ON i.id = r.installation_id
    LIMIT 1`
