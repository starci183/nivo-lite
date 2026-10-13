"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { isWorkspaceId, workspaceNameSchema } from "./workspaces.mapper"
import type { CreatedWorkspaceItem } from "./workspaces.mapper"

/** Creates a free workspace owned by the signed-in person; the database function gates it and makes the creator its owner. */
export const writeCreateWorkspace = async (name: string): Promise<DbOutcome<CreatedWorkspaceItem>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = workspaceNameSchema.safeParse(name)
    if (!parsed.success) return dbFailure("invalid", "WORKSPACES_NAME_INVALID")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("create_free_workspace", { p_name: parsed.data })
    if (error !== null) return rpcFailure(error)
    return isWorkspaceId(data) ? dbOk({ id: data }) : dbFailure("unavailable", "workspace-shape")
}
