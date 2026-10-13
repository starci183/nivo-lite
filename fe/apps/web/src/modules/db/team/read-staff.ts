import "server-only"

import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** One active staff row of a workspace. */
export interface TeamStaff {
    readonly id: string
    readonly name: string
    readonly role: string
}

/** Reads the active staff rows of a workspace under RLS, by name: the candidates for "this person is" and the names of linked members. */
export const readTeamStaff = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<TeamStaff>>> => {
    const client = await createServerDbClient()
    return toOutcome(
        await client
            .from("staff")
            .select("id, name, role")
            .eq("workspace_id", workspaceId)
            .eq("active", true)
            .order("name"),
    )
}
