import "server-only"

import { revalidatePath } from "next/cache"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { readMemberPair } from "./read-member-pair"
import type { MemberPair } from "./read-member-pair"
import { guardMemberCommand } from "./team.mapper"
import type { MemberCommand, SeatRole, SeatStatus } from "./team.mapper"

/** What a command does to the target's row: change a field, or delete the row. */
export type MemberChange =
    | { readonly kind: "member.role_changed"; readonly patch: { readonly role: SeatRole }; readonly summary: string }
    | {
          readonly kind: "member.disabled" | "member.enabled"
          readonly patch: { readonly status: SeatStatus }
          readonly summary: string
      }
    | { readonly kind: "member.removed"; readonly patch: null; readonly summary: string }

/** What a member command asks of the runner. */
export interface MemberCommandSpec {
    /** True for enable, disable and remove, which are never allowed on one's own account. */
    readonly forbidSelf: boolean
    /** The role the member would get, for a role change. */
    readonly nextRole?: SeatRole
    /** The change to make once the guard passed; none means there is nothing to do. */
    readonly change: (pair: MemberPair) => MemberChange | undefined
}

/** The part of a database error this module reads. */
interface DatabaseError {
    readonly code?: string
    readonly message: string
}

/** The failure of a database error; the guard trigger raises `last_owner` in the message. */
const failureOf = (error: DatabaseError): DbOutcome<never> =>
    error.message.includes("last_owner") ? dbFailure("invalid", "last_owner") : toOutcome({ data: null, error })

/**
 * Runs one command on a member of a workspace for the signed-in person: reads both seats under RLS, applies the rule (only owners and
 * managers act; an owner row and the owner role are for owners; nobody disables or removes oneself), changes the row, notes it in the
 * evidence log (best effort) and refreshes the pages.
 */
export const runMemberCommand = async (command: MemberCommand, spec: MemberCommandSpec): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const client = await createServerDbClient()
    const found = await readMemberPair(client, principal.value.id, command)
    if (found.kind !== "ok") return found
    const pair = found.value
    const refusal = guardMemberCommand({
        actorId: pair.actor.userId,
        actorRole: pair.actor.role,
        targetId: pair.target.userId,
        targetRole: pair.target.role,
        nextRole: spec.nextRole,
        forbidSelf: spec.forbidSelf,
    })
    if (refusal !== undefined) return dbFailure("refused", refusal)
    const change = spec.change(pair)
    if (change === undefined) return dbOk(true)
    const scope = { workspace_id: command.workspaceId, user_id: command.userId }
    const result =
        change.patch === null
            ? await client.from("workspace_members").delete().match(scope).select("user_id")
            : await client.from("workspace_members").update(change.patch).match(scope).select("user_id")
    if (result.error !== null) return failureOf(result.error)
    if (result.data.length === 0) return dbFailure("refused", "not-changed")
    await client.from("events").insert({
        workspace_id: command.workspaceId,
        kind: change.kind,
        actor: pair.actor.displayName,
        summary: change.summary,
    })
    revalidatePath("/", "layout")
    return dbOk(true)
}
