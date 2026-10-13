import "server-only"

import { cookies } from "next/headers"
import { cache } from "react"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"

/** The cookie that remembers the workspace the person used last. */
const WORKSPACE_COOKIE = "NIVO_WORKSPACE"

/** The most memberships one person is read with. */
const MEMBERSHIP_LIMIT = 50

/** What a person may do in a workspace. */
export type ActiveRole = "owner" | "manager" | "staff"

/** The workspace the current request works in and the caller's role there. */
export interface ActiveWorkspace {
    /** The workspace id. */
    readonly id: string
    /** The caller's role in it. */
    readonly role: ActiveRole
}

const roleOf = (value: string): ActiveRole | undefined =>
    (["owner", "manager", "staff"] as const).find((role) => role === value)

/**
 * The workspace of the request: the one the cookie names when the caller is an active member of it, else the oldest membership.
 * Read under RLS, so the caller only ever sees their own memberships.
 */
export const readActiveWorkspace = cache(async (): Promise<DbOutcome<ActiveWorkspace>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("workspace_members")
            .select("workspace_id, role")
            .eq("user_id", principal.value.id)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(MEMBERSHIP_LIMIT),
    )
    if (rows.kind !== "ok") return rows
    const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value
    const row = rows.value.find((entry) => entry.workspace_id === wanted) ?? rows.value[0]
    const role = row === undefined ? undefined : roleOf(row.role)
    if (row === undefined || role === undefined) return dbFailure("refused", "no-workspace")
    return dbOk({ id: row.workspace_id, role })
})
