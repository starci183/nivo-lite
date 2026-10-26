import { sql } from "@modules/platform/database"

/**
 * The installation that owns a record, when the row says so ($1 workspace, $2 record). A record lives in one of
 * work_items, agent_conversations, bookings, lead_flows or leads; this only reads the installation column.
 */
export const INSTALLATION_OF_RECORD = sql`
    SELECT installation_id AS "installationId"
    FROM (
        SELECT installation_id FROM public.work_items WHERE workspace_id = $1 AND id = $2
        UNION ALL
        SELECT installation_id FROM public.agent_conversations WHERE workspace_id = $1 AND id = $2
        UNION ALL
        SELECT installation_id FROM public.bookings WHERE workspace_id = $1 AND id = $2
        UNION ALL
        SELECT installation_id FROM public.lead_flows WHERE workspace_id = $1 AND id = $2
        UNION ALL
        SELECT installation_id FROM public.leads WHERE workspace_id = $1 AND id = $2
    ) found
    WHERE installation_id IS NOT NULL
    LIMIT 1`

/** Every installation of a workspace, oldest first, with its agent and its active version. */
export const LIST_INSTALLATIONS = sql`
    SELECT i.id, i.workspace_id AS "workspaceId", i.module_key AS "moduleKey", i.name, i.is_multi AS "isMulti",
           i.agent_id AS "agentId", COALESCE(a.name, '') AS "agentName", COALESCE(a.handle, i.module_key) AS "agentHandle",
           a.avatar_url AS "agentAvatarUrl",
           i.status, i.operating_mode AS "operatingMode", i.live_enabled AS "liveEnabled",
           i.active_context_version_id AS "activeContextVersionId", v.version AS "activeVersion", i.settings,
           to_json(i.created_at) #>> '{}' AS "createdAt"
    FROM public.module_installations i
    LEFT JOIN public.agents a ON a.id = i.agent_id
    LEFT JOIN public.module_context_versions v ON v.id = i.active_context_version_id
    WHERE i.workspace_id = $1 AND i.status <> 'removed'
    ORDER BY i.created_at ASC, i.id ASC
    LIMIT 200`

/** One installation of a workspace by id. */
export const FIND_INSTALLATION = sql`
    SELECT i.id, i.workspace_id AS "workspaceId", i.module_key AS "moduleKey", i.name, i.is_multi AS "isMulti",
           i.agent_id AS "agentId", COALESCE(a.name, '') AS "agentName", COALESCE(a.handle, i.module_key) AS "agentHandle",
           a.avatar_url AS "agentAvatarUrl",
           i.status, i.operating_mode AS "operatingMode", i.live_enabled AS "liveEnabled",
           i.active_context_version_id AS "activeContextVersionId", v.version AS "activeVersion", i.settings,
           to_json(i.created_at) #>> '{}' AS "createdAt"
    FROM public.module_installations i
    LEFT JOIN public.agents a ON a.id = i.agent_id
    LEFT JOIN public.module_context_versions v ON v.id = i.active_context_version_id
    WHERE i.workspace_id = $1 AND i.id = $2
    LIMIT 1`

/** One installation by id, whatever its workspace (for a caller that already proved the workspace another way). */
export const FIND_INSTALLATION_BY_ID = sql`
    SELECT i.id, i.workspace_id AS "workspaceId", i.module_key AS "moduleKey", i.name, i.is_multi AS "isMulti",
           i.agent_id AS "agentId", COALESCE(a.name, '') AS "agentName", COALESCE(a.handle, i.module_key) AS "agentHandle",
           a.avatar_url AS "agentAvatarUrl",
           i.status, i.operating_mode AS "operatingMode", i.live_enabled AS "liveEnabled",
           i.active_context_version_id AS "activeContextVersionId", v.version AS "activeVersion", i.settings,
           to_json(i.created_at) #>> '{}' AS "createdAt"
    FROM public.module_installations i
    LEFT JOIN public.agents a ON a.id = i.agent_id
    LEFT JOIN public.module_context_versions v ON v.id = i.active_context_version_id
    WHERE i.id = $1
    LIMIT 1`

/** The oldest installation of a module in a workspace. */
export const FIND_FIRST_OF_MODULE = sql`
    SELECT i.id, i.workspace_id AS "workspaceId", i.module_key AS "moduleKey", i.name, i.is_multi AS "isMulti",
           i.agent_id AS "agentId", COALESCE(a.name, '') AS "agentName", COALESCE(a.handle, i.module_key) AS "agentHandle",
           a.avatar_url AS "agentAvatarUrl",
           i.status, i.operating_mode AS "operatingMode", i.live_enabled AS "liveEnabled",
           i.active_context_version_id AS "activeContextVersionId", v.version AS "activeVersion", i.settings,
           to_json(i.created_at) #>> '{}' AS "createdAt"
    FROM public.module_installations i
    LEFT JOIN public.agents a ON a.id = i.agent_id
    LEFT JOIN public.module_context_versions v ON v.id = i.active_context_version_id
    WHERE i.workspace_id = $1 AND i.module_key = $2 AND i.status <> 'removed'
    ORDER BY i.created_at ASC, i.id ASC
    LIMIT 1`

/** The installation that owns an agent. */
export const FIND_OF_AGENT = sql`
    SELECT i.id, i.workspace_id AS "workspaceId", i.module_key AS "moduleKey", i.name, i.is_multi AS "isMulti",
           i.agent_id AS "agentId", COALESCE(a.name, '') AS "agentName", COALESCE(a.handle, i.module_key) AS "agentHandle",
           a.avatar_url AS "agentAvatarUrl",
           i.status, i.operating_mode AS "operatingMode", i.live_enabled AS "liveEnabled",
           i.active_context_version_id AS "activeContextVersionId", v.version AS "activeVersion", i.settings,
           to_json(i.created_at) #>> '{}' AS "createdAt"
    FROM public.module_installations i
    LEFT JOIN public.agents a ON a.id = i.agent_id
    LEFT JOIN public.module_context_versions v ON v.id = i.active_context_version_id
    WHERE i.workspace_id = $1 AND i.agent_id = $2
    LIMIT 1`

/** The labels of the instances of a type, except one ($3 may be null). */
export const LIST_INSTANCE_NAMES = sql`
    SELECT i.id, i.name
    FROM public.module_installations i
    WHERE i.workspace_id = $1 AND i.module_key = $2 AND i.status <> 'removed' AND ($3::uuid IS NULL OR i.id <> $3::uuid)
    LIMIT 1000`

/** The agents of a workspace that an installation already drives. */
export const LIST_BOUND_AGENTS = sql`
    SELECT i.agent_id AS id
    FROM public.module_installations i
    WHERE i.workspace_id = $1 AND i.agent_id IS NOT NULL
    LIMIT 1000`

/** Installs a module in setup ($1 workspace, $2 module, $3 name, $4 agent, $5 operating mode). */
export const INSERT_INSTALLATION = sql`
    INSERT INTO public.module_installations (workspace_id, module_key, name, agent_id, status, operating_mode)
    VALUES ($1, $2, $3, $4, 'setup', $5)
    RETURNING id`

/** Renames an instance ($1 id, $2 workspace, $3 name). */
export const RENAME_INSTALLATION = sql`
    WITH changed AS (
        UPDATE public.module_installations
        SET name = $3
        WHERE id = $1 AND workspace_id = $2
        RETURNING id)
    SELECT id FROM changed`

/** Sets how the agent runs ($1 id, $2 workspace, $3 mode). */
export const SET_OPERATING_MODE = sql`
    WITH changed AS (
        UPDATE public.module_installations
        SET operating_mode = $3
        WHERE id = $1 AND workspace_id = $2
        RETURNING id)
    SELECT id FROM changed`

/**
 * Switches the agent live or paused ($1 id, $2 workspace, $3 live, $4 status). Going live needs an applied context version: the
 * guard lives in the statement, so no caller can switch on an agent that has nothing confirmed to run on.
 */
export const SET_LIVE = sql`
    WITH changed AS (
        UPDATE public.module_installations
        SET live_enabled = $3, status = $4
        WHERE id = $1 AND workspace_id = $2 AND (NOT $3::boolean OR active_context_version_id IS NOT NULL)
        RETURNING id)
    SELECT id FROM changed`

/** Replaces the settings of an installation ($1 id, $2 workspace, $3 settings JSON). */
export const SAVE_SETTINGS = sql`
    WITH changed AS (
        UPDATE public.module_installations
        SET settings = $3::jsonb
        WHERE id = $1 AND workspace_id = $2
        RETURNING id)
    SELECT id FROM changed`

/**
 * Moves an installation by the readiness of its connections ($1 installation, $2 workspace, $3 ready): ready or live without them
 * waits for a connection; waiting with them returns to what it was before: live when the owner had switched it on, else ready. Any
 * other status is left as it is. Answers the new status when it moved.
 */
export const SETTLE_CONNECTION = sql`
    WITH settled AS (
        UPDATE public.module_installations
        SET status = CASE WHEN NOT $3::boolean THEN 'needs_connection' WHEN live_enabled THEN 'live' ELSE 'ready' END
        WHERE id = $1 AND workspace_id = $2
          AND ((NOT $3::boolean AND status IN ('ready', 'live')) OR ($3::boolean AND status = 'needs_connection'))
        RETURNING status)
    SELECT status FROM settled`

/** Points the installation at a freshly applied version ($1 id, $2 workspace, $3 version, $4 status). */
export const ACTIVATE_VERSION = sql`
    WITH changed AS (
        UPDATE public.module_installations
        SET active_context_version_id = $3, status = $4
        WHERE id = $1 AND workspace_id = $2
        RETURNING id)
    SELECT id FROM changed`

/** Where the OpenClaw copy of an installation stands. */
export const FIND_SYNC_STATUS = sql`
    SELECT s.status AS state, s.context_version AS "syncedVersion", v.version AS "activeVersion",
           to_json(s.checked_at) #>> '{}' AS "checkedAt", s.error
    FROM public.module_installations i
    LEFT JOIN public.module_context_versions v ON v.id = i.active_context_version_id
    LEFT JOIN public.openclaw_agent_sync s ON s.installation_id = i.id
    WHERE i.workspace_id = $1 AND i.id = $2
    LIMIT 1`

/** Up to $2 installations that run on OpenClaw, of one workspace or of all when $1 is null. */
export const LIST_ON_OPENCLAW = sql`
    SELECT i.id, i.workspace_id AS "workspaceId"
    FROM public.module_installations i
    WHERE ($1::uuid IS NULL OR i.workspace_id = $1::uuid) AND i.status <> 'removed'
      AND COALESCE(i.settings ->> 'processor', '') <> 'nivo'
    ORDER BY i.created_at ASC, i.id ASC
    LIMIT $2`

/** What the workspace has for the requirements of a module: connected providers and the head counts ($1 workspace). */
export const FIND_REQUIREMENT_FACTS = sql`
    SELECT
        ARRAY(SELECT DISTINCT c.provider FROM public.connections c
              WHERE c.workspace_id = $1 AND c.status <> 'disconnected' LIMIT 200) AS providers,
        (SELECT count(*)::int FROM public.agents a
         WHERE a.workspace_id = $1 AND a.module IN ('chatbot', 'booking') AND a.status = 'active') AS "chatAgents",
        (SELECT count(*)::int FROM public.staff s WHERE s.workspace_id = $1 AND s.active) AS staff,
        (SELECT count(*)::int FROM public.workspace_members m WHERE m.workspace_id = $1 AND m.status = 'active') AS members
    LIMIT 1`

/** The workspaces where a module is installed, for a morning run across workspaces ($1 module key). */
export const LIST_WORKSPACES_OF_MODULE = sql`
    SELECT DISTINCT workspace_id AS id FROM public.module_installations WHERE module_key = $1 AND status <> 'removed' ORDER BY workspace_id LIMIT 1000`

/**
 * Removes an installed agent for good ($1 id, $2 workspace, $3 who). It is terminal: the row stays for history (conversations,
 * versions, knowledge keep pointing at it), nothing runs, and it leaves every list. Removing it twice changes nothing.
 */
export const REMOVE_INSTALLATION = sql`
    WITH changed AS (
        UPDATE public.module_installations
        SET status = 'removed', live_enabled = false, removed_at = now(), removed_by = $3
        WHERE id = $1 AND workspace_id = $2 AND status <> 'removed'
        RETURNING id)
    SELECT id FROM changed`
