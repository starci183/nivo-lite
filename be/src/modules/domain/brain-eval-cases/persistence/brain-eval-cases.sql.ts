import { sql } from "@modules/platform/database"

/** Keeps each case once by its origin; answers the cases that were new ($1 workspace, $2 module, $3 origin refs, $4 inputs, $5 expected answers). */
export const INSERT_EVAL_CASES = sql`WITH changed AS (
    INSERT INTO public.brain_eval_cases (workspace_id, module, kind, input, expected, origin_ref)
    SELECT $1, $2, 'draft', t.input::jsonb, t.expected::jsonb, t.origin_ref
    FROM unnest($3::text[], $4::text[], $5::text[]) AS t(origin_ref, input, expected)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.brain_eval_cases c WHERE c.workspace_id = $1 AND c.origin_ref = t.origin_ref
    )
    RETURNING id
)
SELECT id FROM changed`
