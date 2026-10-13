import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { memberItemsOf, rosterInvitesOf } from "./team.mapper"
import type { TeamRoster } from "./team.mapper"

/**
 * Reads the members and the open invitations of a workspace under RLS. The emails and last sign-ins come from a definer function that
 * answers managers only, so a staff viewer sees blanks; the open invitations are the managers' rows.
 */
export const readTeamRoster = async (workspaceId: string): Promise<DbOutcome<TeamRoster>> => {
    const client = await createServerDbClient()
    const now = new Date()
    const [members, contacts, invites] = await Promise.all([
        client
            .from("workspace_members")
            .select("user_id, workspace_id, role, staff_id, display_name, status")
            .eq("workspace_id", workspaceId)
            .order("created_at")
            .limit(500),
        client.rpc("workspace_member_contacts", { p_workspace: workspaceId }),
        client
            .from("workspace_invites")
            .select("id, email, role, staff_id, created_at, expires_at")
            .eq("workspace_id", workspaceId)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .gt("expires_at", now.toISOString())
            .order("created_at", { ascending: false })
            .limit(200),
    ])
    const memberRows = toOutcome(members)
    if (memberRows.kind !== "ok") return memberRows
    if (contacts.error !== null) return rpcFailure(contacts.error)
    if (invites.error !== null) return dbFailure("unavailable", invites.error.code)
    return dbOk({
        members: memberItemsOf(memberRows.value, contacts.data),
        invites: rosterInvitesOf(invites.data, now.getTime()),
    })
}
