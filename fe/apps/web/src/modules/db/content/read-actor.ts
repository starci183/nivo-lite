import "server-only"

import { cache } from "react"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { readActiveWorkspace } from "../workspace/read-active-workspace"

/** Who is working in the content module and what they may do. */
export interface ContentActor {
    /** The workspace of the request. */
    readonly workspaceId: string
    /** The member's display name in it (what the history shows). */
    readonly name: string
    /** Whether the member is an owner or a manager. */
    readonly canManage: boolean
}

/** The member of the request in their workspace, with the name the history shows. */
export const readContentActor = cache(async (): Promise<DbOutcome<ContentActor>> => {
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const client = await createServerDbClient()
    const member = toOutcome(
        await client
            .from("workspace_members")
            .select("display_name")
            .eq("workspace_id", workspace.value.id)
            .eq("user_id", principal.value.id)
            .maybeSingle(),
    )
    if (member.kind !== "ok") return member
    return dbOk({
        workspaceId: workspace.value.id,
        name: member.value.display_name,
        canManage: workspace.value.role === "owner" || workspace.value.role === "manager",
    })
})

/** The actor when they may manage content; a role failure otherwise. */
export const readContentManager = async (): Promise<DbOutcome<ContentActor>> => {
    const actor = await readContentActor()
    if (actor.kind !== "ok") return actor
    return actor.value.canManage ? actor : dbFailure("refused", "role")
}
