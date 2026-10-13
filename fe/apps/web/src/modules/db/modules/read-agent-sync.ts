import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** Where the OpenClaw copy of the agent of an installation stands. */
export type AgentSyncState = "none" | "syncing" | "ok" | "error"

/** The OpenClaw copy of an agent against the context version that is active, and whether a sync is queued or running. */
export type AgentSyncStatus = {
    readonly state: AgentSyncState
    /** The context version OpenClaw holds; null when none is applied or there is no copy. */
    readonly syncedVersion: number | null
    /** The context version that is active in the database. */
    readonly activeVersion: number | null
    readonly checkedAt: string | null
    readonly error: string | null
}

const stateOf = (isSyncing: boolean, status: string | undefined): AgentSyncState => {
    if (isSyncing) return "syncing"
    if (status === undefined) return "none"
    return status === "error" ? "error" : "ok"
}

/** Reads the sync status of the agent of an installation. */
export const readAgentSync = async (installationId: string): Promise<DbOutcome<AgentSyncStatus>> => {
    const client = await createServerDbClient()
    const installation = toOutcome(
        await client
            .from("module_installations")
            .select("active:module_context_versions!module_installations_active_version_fk(version)")
            .eq("id", installationId)
            .maybeSingle(),
    )
    if (installation.kind !== "ok") return installation
    const [copy, pending] = await Promise.all([
        client
            .from("openclaw_agent_sync")
            .select("status, context_version, checked_at, error")
            .eq("installation_id", installationId)
            .maybeSingle(),
        client
            .from("engine_jobs")
            .select("id", { count: "exact", head: true })
            .eq("kind", "openclaw.sync_agent")
            .eq("payload->>installation_id", installationId)
            .in("status", ["queued", "running"]),
    ])
    if (copy.error !== null || pending.error !== null)
        return toOutcome({ data: null, error: copy.error ?? pending.error })
    return dbOk({
        state: stateOf((pending.count ?? 0) > 0, copy.data?.status),
        syncedVersion: copy.data?.context_version ?? null,
        activeVersion: installation.value.active?.version ?? null,
        checkedAt: copy.data?.checked_at ?? null,
        error: copy.data?.error ?? null,
    })
}
