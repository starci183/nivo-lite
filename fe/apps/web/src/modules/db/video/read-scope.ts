import "server-only"

import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { readActiveWorkspace } from "../workspace/read-active-workspace"

/** Who is writing and where: the workspace of the request and the person, only for owners and managers. */
export interface ManagerScope {
    /** Workspace id. */
    readonly workspaceId: string
    /** The person's user id. */
    readonly userId: string
    /** The name shown in evidence lines. */
    readonly actor: string
    /** The person's role. */
    readonly role: "owner" | "manager"
}

/** Resolves the workspace and person of a write; staff and signed-out callers are refused. */
export const readManagerScope = async (): Promise<DbOutcome<ManagerScope>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const role = workspace.value.role
    if (role === "staff") return dbFailure("refused", "role")
    const name = principal.value.metadata.full_name ?? principal.value.metadata.name ?? principal.value.email ?? ""
    return dbOk({ workspaceId: workspace.value.id, userId: principal.value.id, actor: name, role })
}
