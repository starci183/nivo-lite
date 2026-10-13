import { sql } from "@modules/platform/database"

/** The applied versions of an installation, newest first. */
export const LIST_CONTEXT_VERSIONS = sql`
    SELECT v.id, v.installation_id AS "installationId", v.version, v.snapshot, v.applied_by AS "appliedBy",
           to_json(v.applied_at) #>> '{}' AS "appliedAt"
    FROM public.module_context_versions v
    WHERE v.installation_id = $1
    ORDER BY v.version DESC
    LIMIT 100`

/** One version by id. */
export const FIND_CONTEXT_VERSION = sql`
    SELECT v.id, v.installation_id AS "installationId", v.version, v.snapshot, v.applied_by AS "appliedBy",
           to_json(v.applied_at) #>> '{}' AS "appliedAt"
    FROM public.module_context_versions v
    WHERE v.id = $1
    LIMIT 1`

/** The newest version of an installation. */
export const FIND_LATEST_CONTEXT_VERSION = sql`
    SELECT v.id, v.installation_id AS "installationId", v.version, v.snapshot, v.applied_by AS "appliedBy",
           to_json(v.applied_at) #>> '{}' AS "appliedAt"
    FROM public.module_context_versions v
    WHERE v.installation_id = $1
    ORDER BY v.version DESC
    LIMIT 1`

/** Stores a new immutable version ($1 workspace, $2 installation, $3 version, $4 snapshot JSON, $5 applied by). */
export const INSERT_CONTEXT_VERSION = sql`
    INSERT INTO public.module_context_versions (workspace_id, installation_id, version, snapshot, applied_by)
    VALUES ($1, $2, $3, $4::jsonb, $5)
    RETURNING id, installation_id AS "installationId", version, snapshot, applied_by AS "appliedBy",
              to_json(applied_at) #>> '{}' AS "appliedAt"`
