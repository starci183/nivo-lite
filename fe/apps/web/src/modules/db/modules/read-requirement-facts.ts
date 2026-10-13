import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

const PROVIDERS_LIMIT = 200

/** What a workspace has, as far as the requirements of a module are concerned. */
export type RequirementFacts = {
    readonly providers: ReadonlyArray<string>
    readonly chatAgents: number
    readonly staff: number
    readonly members: number
}

/** Reads the connected providers and the head counts that decide whether the requirements of a module are met. */
export const readRequirementFacts = async (workspaceId: string): Promise<DbOutcome<RequirementFacts>> => {
    const client = await createServerDbClient()
    const [connections, agents, staff, members] = await Promise.all([
        client
            .from("connections")
            .select("provider")
            .eq("workspace_id", workspaceId)
            .neq("status", "disconnected")
            .limit(PROVIDERS_LIMIT),
        client
            .from("agents")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .in("module", ["chatbot", "booking"])
            .eq("status", "active"),
        client
            .from("staff")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("active", true),
        client
            .from("workspace_members")
            .select("user_id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "active"),
    ])
    const providers = toOutcome(connections)
    if (providers.kind !== "ok") return providers
    if (agents.error !== null || staff.error !== null || members.error !== null)
        return dbFailure("unavailable", "counts")
    return dbOk({
        providers: providers.value.map((row) => row.provider),
        chatAgents: agents.count ?? 0,
        staff: staff.count ?? 0,
        members: members.count ?? 0,
    })
}
