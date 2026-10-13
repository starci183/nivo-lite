import "server-only"

import { cache } from "react"
import { dbFailure, dbOk, toOutcome } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { createServerDbClient } from "@/modules/db/server"
import type { Connection } from "@/modules/types"
import {
    CONNECTION_COLUMNS,
    GRANT_COLUMNS,
    grantsByConnection,
    isWorkspaceId,
    toConnection,
} from "./connections.mapper"

/** The most connections and grants a workspace page reads. */
const PAGE_LIMIT = 200
const GRANT_LIMIT = 2000

/**
 * Reads the workspace connections with the agents bound to each, under RLS (members read the facts; the encrypted credential
 * lives in a table this reader never touches). The Google Drive read grant lives in the documents drawer, not in this list.
 */
export const readConnections = cache(async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<Connection>>> => {
    if (!isWorkspaceId(workspaceId)) return dbFailure("invalid", "workspace")
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("connections")
            .select(CONNECTION_COLUMNS)
            .eq("workspace_id", workspaceId)
            .neq("provider", "google_drive")
            .order("created_at")
            .limit(PAGE_LIMIT),
    )
    if (rows.kind !== "ok") return rows
    const links = toOutcome(
        await client
            .from("agent_connections")
            .select(GRANT_COLUMNS)
            .eq("workspace_id", workspaceId)
            .in(
                "connection_id",
                rows.value.map((row) => row.id),
            )
            .limit(GRANT_LIMIT),
    )
    if (links.kind !== "ok") return links
    const byConnection = grantsByConnection(links.value)
    return dbOk(
        rows.value.flatMap((row) => {
            const connection = toConnection(row, byConnection.get(row.id) ?? [])
            return connection === null ? [] : [connection]
        }),
    )
})
