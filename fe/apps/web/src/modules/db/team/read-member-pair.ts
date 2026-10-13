import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import type { MemberCommand, SeatRole, SeatStatus } from "./team.mapper"

/** One member row as a command needs it. */
export interface PairMember {
    readonly userId: string
    readonly role: SeatRole
    readonly status: SeatStatus
    readonly displayName: string
}

/** The person asking and the member being changed. */
export interface MemberPair {
    readonly actor: PairMember
    readonly target: PairMember
}

const roleOf = (value: string): SeatRole => (value === "owner" || value === "manager" ? value : "staff")

const statusOf = (value: string): SeatStatus => (value === "disabled" ? "disabled" : "active")

/** Reads the asker's seat and the target's seat in one workspace under RLS; either missing is a refusal or a not-found. */
export const readMemberPair = async (
    client: SupabaseClient<Database>,
    actorId: string,
    command: MemberCommand,
): Promise<DbOutcome<MemberPair>> => {
    const rows = toOutcome(
        await client
            .from("workspace_members")
            .select("user_id, role, status, display_name")
            .eq("workspace_id", command.workspaceId)
            .in("user_id", [actorId, command.userId]),
    )
    if (rows.kind !== "ok") return rows
    const members = rows.value.map((row): PairMember => ({
        userId: row.user_id,
        role: roleOf(row.role),
        status: statusOf(row.status),
        displayName: row.display_name,
    }))
    const actor = members.find((member) => member.userId === actorId)
    const target = members.find((member) => member.userId === command.userId)
    if (actor === undefined) return dbFailure("refused", "not-member")
    if (target === undefined) return dbFailure("not-found", "member")
    return dbOk({ actor, target })
}
