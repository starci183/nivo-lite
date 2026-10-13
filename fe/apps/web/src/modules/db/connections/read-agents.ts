import "server-only"

import { cache } from "react"
import { dbFailure, toOutcome } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { createServerDbClient } from "@/modules/db/server"
import { isWorkspaceId } from "./connections.mapper"

/** The agent columns the Connections page needs. */
const AGENT_COLUMNS = "id, name, module, status"
const AGENT_LIMIT = 200

/** One agent of the workspace as the connections console lists it. */
export interface ConnectionAgent {
    readonly id: string
    readonly name: string
    readonly module: string
    readonly status: string
}

/** Reads the workspace agents (any module, any status) under RLS: the board names the agents bound to each connection. */
export const readAgents = cache(async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<ConnectionAgent>>> => {
    if (!isWorkspaceId(workspaceId)) return dbFailure("invalid", "workspace")
    const client = await createServerDbClient()
    return toOutcome(
        await client
            .from("agents")
            .select(AGENT_COLUMNS)
            .eq("workspace_id", workspaceId)
            .order("created_at")
            .limit(AGENT_LIMIT),
    )
})
