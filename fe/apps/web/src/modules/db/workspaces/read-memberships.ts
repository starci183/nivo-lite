import "server-only"

import { toOutcome, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { membershipItemsOf } from "./workspaces.mapper"
import type { MembershipItem } from "./workspaces.mapper"

/** Reads every workspace the caller belongs to with the caller's seat in each, oldest first, under RLS. */
export const readMemberships = async (): Promise<DbOutcome<ReadonlyArray<MembershipItem>>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("workspace_members")
            .select("workspace_id, role, status, workspaces(name, status, created_at, business_type)")
            .eq("user_id", principal.value.id)
            .order("created_at")
            .limit(500),
    )
    return rows.kind === "ok" ? dbOk(membershipItemsOf(rows.value)) : rows
}
