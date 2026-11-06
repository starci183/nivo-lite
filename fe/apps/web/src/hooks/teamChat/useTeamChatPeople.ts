"use client"

import { useMemo } from "react"
import { useQueryAgentsSwr, useQueryWorkspaceMembersSwr } from "@/hooks/swr"
import { useMember } from "@/hooks/member"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { ChatParty } from "@/modules/teamChat"

/** The people and agents a new room may name. */
export interface TeamChatPeople {
    readonly people: ReadonlyArray<ChatParty>
    readonly agents: ReadonlyArray<ChatParty>
}

/** The active members of the workspace (the viewer left out) and its agents, for the new-chat form. Both wait until the form is open. */
export const useTeamChatPeople = (isWanted: boolean): TeamChatPeople => {
    const workspaceId = useWorkspaceId()
    const viewerId = useMember()?.userId
    const members = useQueryWorkspaceMembersSwr(isWanted ? workspaceId : undefined)
    const agents = useQueryAgentsSwr(isWanted ? {} : null)
    return useMemo(
        () => ({
            people: (members.data ?? [])
                .filter((entry) => entry.status === "active" && entry.userId !== viewerId)
                .map((entry) => ({ kind: "user" as const, id: entry.userId, name: entry.displayName })),
            agents: (agents.data ?? []).map((agent) => ({ kind: "agent" as const, id: agent.id, name: agent.name })),
        }),
        [agents.data, members.data, viewerId],
    )
}
