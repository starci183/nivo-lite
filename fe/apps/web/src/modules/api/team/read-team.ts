import "server-only"

import { decoded } from "../decode"
import type { Outcome } from "../outcome"
import { apiRequest } from "../request"
import { decodeInvites, decodeMembers, withExpiry } from "./team.mapper"
import type { TeamRoster } from "./team.mapper"

/** Reads the members and the open invitations of a workspace; the first failure is the outcome. */
export const readTeamRoster = async (workspaceId: string): Promise<Outcome<TeamRoster>> => {
    const [members, invites] = await Promise.all([
        apiRequest<unknown>("/workspaces/members", { workspaceId }),
        apiRequest<unknown>("/workspaces/invites", { workspaceId }),
    ])
    const memberList = decoded(members, decodeMembers)
    if (memberList.kind !== "ok") return memberList
    const inviteList = decoded(invites, decodeInvites)
    if (inviteList.kind !== "ok") return inviteList
    return { kind: "ok", value: { members: memberList.value, invites: withExpiry(inviteList.value, Date.now()) } }
}
