import "server-only"

import { cache } from "react"
import type { Agent } from "@/lib/types"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toAgent, toAgents } from "./overview.mapper"

const AGENT_LIMIT = 200

/** The agents of one workspace, oldest first, under the caller RLS. */
export const readAgents = cache(async (workspaceId: string): Promise<DbOutcome<Array<Agent>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client.from("agents").select("*").eq("workspace_id", workspaceId).order("created_at").limit(AGENT_LIMIT),
    )
    return rows.kind === "ok" ? dbOk(toAgents(rows.value)) : rows
})

/** One agent by id; an agent of another workspace, or of an unknown module, is not found. */
export const readAgent = async (agentId: string): Promise<DbOutcome<Agent>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(await client.from("agents").select("*").eq("id", agentId).limit(1))
    if (rows.kind !== "ok") return rows
    const first = rows.value[0]
    const agent = first === undefined ? null : toAgent(first)
    return agent === null ? dbFailure("not-found", "agent") : dbOk(agent)
}

/** The name of the instance each agent drives, for the agents of a multi-instance type (agent id to instance name). */
export const readInstanceNames = async (
    agentIds: ReadonlyArray<string>,
): Promise<DbOutcome<ReadonlyMap<string, string>>> => {
    if (agentIds.length === 0) return dbOk(new Map())
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("module_installations")
            .select("agent_id, name, is_multi")
            .in("agent_id", [...agentIds])
            .limit(AGENT_LIMIT),
    )
    if (rows.kind !== "ok") return rows
    const names = new Map<string, string>()
    for (const row of rows.value) {
        if (row.is_multi && row.agent_id !== null) names.set(row.agent_id, row.name)
    }
    return dbOk(names)
}
