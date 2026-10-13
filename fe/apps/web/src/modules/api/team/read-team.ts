import "server-only"

import { request } from "../client"
import type { Outcome } from "../outcome"
import { decodeInvites, decodeMembers, withExpiry } from "./team.mapper"
import type { TeamRoster } from "./team.mapper"

/** What a roster read needs: the caller token, the page language and the workspace. */
export interface TeamRosterQuery {
    readonly token: string
    readonly locale: string
    readonly workspaceId: string
}

/** Reads the members and the open invitations of a workspace; the first failure is the outcome. */
export const readTeamRoster = async (query: TeamRosterQuery): Promise<Outcome<TeamRoster>> => {
    const [members, invites] = await Promise.all([
        request({ ...query, path: "/workspaces/members" }, decodeMembers),
        request({ ...query, path: "/workspaces/invites" }, decodeInvites),
    ])
    if (members.kind !== "ok") return members
    if (invites.kind !== "ok") return invites
    return { kind: "ok", value: { members: members.value, invites: withExpiry(invites.value, Date.now()) } }
}
